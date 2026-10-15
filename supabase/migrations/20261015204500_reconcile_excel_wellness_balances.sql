-- Preserve original uploaded Excel wellness transactions unchanged.
-- Specific empty used-days cells are reconciled against the source Excel
-- remaining balance and leave dates; future debits use effective usage.
create table if not exists public.service_credit_wellness_reconciliations (
 transaction_id uuid primary key references public.service_credit_transactions(id) on delete restrict,
 original_used_days numeric(12,4) not null,
 corrected_used_days numeric(12,4) not null check(corrected_used_days>=0 and corrected_used_days<=5),
 source_balance_after numeric(12,4) not null,
 source_file text not null,
 source_sheet text not null,
 source_row integer not null,
 reason text not null,
 reconciled_at timestamptz not null default now()
);
alter table public.service_credit_wellness_reconciliations enable row level security;
revoke all on public.service_credit_wellness_reconciliations from anon,authenticated;
grant select on public.service_credit_wellness_reconciliations to service_role;

insert into public.service_credit_wellness_reconciliations
 (transaction_id,original_used_days,corrected_used_days,source_balance_after,source_file,source_sheet,source_row,reason)
select t.id,t.service_credits_used,c.effective_days,t.balance_after,t.source_file,t.source_sheet,t.source_row,
 'Source workbook TOTAL BALANCE and Wellness Leave PARTICULARS show days consumed, but USED cell is blank. Original Excel import remains intact.'
from public.service_credit_transactions t
join (values
 ('32185ed7-84ca-4040-a8fa-09ead7c5ebed'::uuid,3::numeric,'CABANAS, BEDA D..xlsx'::text,6),
 ('028bc8a8-118d-4a3d-b903-416a9cf04b97'::uuid,3::numeric,'CABANAS, JOSUE C..xlsx'::text,6),
 ('32c62a17-358a-4325-b836-d84ef17a2c1c'::uuid,2::numeric,'LACADIN, GERELYN DIANE A..xlsx'::text,7)
) as c(transaction_id,effective_days,file_name,excel_row) on c.transaction_id=t.id
where t.credit_type='wellness_leave' and t.source='excel_import' and t.service_credits_used=0
 and t.source_file like ('%'||c.file_name) and t.source_row=c.excel_row
 and (
  (t.service_credits_earned=5 and t.balance_after=2 and c.effective_days=3)
  or (t.service_credits_earned=2 and t.balance_after=0 and c.effective_days=2)
 )
on conflict(transaction_id) do nothing;

do $$
declare corrected_count integer;
begin
 select count(*) into corrected_count
 from public.service_credit_wellness_reconciliations
 where transaction_id in(
  '32185ed7-84ca-4040-a8fa-09ead7c5ebed','028bc8a8-118d-4a3d-b903-416a9cf04b97',
  '32c62a17-358a-4325-b836-d84ef17a2c1c'
 );
 if corrected_count<>3 then raise exception 'Expected three verified Excel wellness reconciliations; found %',corrected_count; end if;
end $$;

-- Correct the annual balance enforcement: check actual Excel-effective used
-- days rather than blanks from the source's USED column.
CREATE OR REPLACE FUNCTION private.prepare_service_credit_transaction()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_role text;
  v_requested_role text;
  v_nt_active boolean;
  v_current numeric(12,4);
  v_owner_key text;
  v_year_start date;
  v_wellness_used numeric(12,4);
begin
  if num_nonnulls(new.personnel_id, new.non_teaching_personnel_id) <> 1 then
    raise exception 'Exactly one personnel owner is required.';
  end if;

  if new.personnel_id is not null then
    select p.role, p.requested_role
      into v_role, v_requested_role
    from public.profiles p
    where p.id = new.personnel_id;

    if v_role is null then
      raise exception 'Personnel account not found.';
    end if;

    if v_role = 'student' or v_requested_role = 'student' then
      raise exception 'Learner accounts cannot receive service credit transactions.';
    end if;

    v_owner_key := 'profile:' || new.personnel_id::text;
  else
    select nt.is_active
      into v_nt_active
    from public.non_teaching_personnel nt
    where nt.id = new.non_teaching_personnel_id;

    if v_nt_active is distinct from true then
      raise exception 'Active Non-Teaching Personnel record not found.';
    end if;

    v_owner_key := 'non_teaching:' || new.non_teaching_personnel_id::text;
  end if;

  if new.source = 'manual' then
    perform pg_advisory_xact_lock(
      hashtextextended(v_owner_key || ':' || new.credit_type ||
        case when new.credit_type = 'wellness_leave' then ':' || extract(year from new.posting_date)::text else '' end, 0)
    );

    -- Wellness Leave is a fresh 5-day calendar-year allowance, never a Service Credit debit.
    -- Previous calendar-year balances do not roll over and imported balances do not add entitlement.
    if new.credit_type = 'wellness_leave' then
      if new.transaction_kind <> 'debit' or new.service_credits_used <= 0
         or new.service_credits_earned <> 0 then
        raise exception 'Wellness Leave may only be deducted from its annual allowance.';
      end if;
      if new.posting_date > (now() at time zone 'Asia/Manila')::date then
        raise exception 'Cannot deduct Wellness Leave for a future date.';
      end if;

      v_year_start := make_date(extract(year from new.posting_date)::int, 1, 1);
      select coalesce(sum(coalesce(w.corrected_used_days,t.service_credits_used)), 0)
        into v_wellness_used
      from public.service_credit_transactions t
      left join public.service_credit_wellness_reconciliations w on w.transaction_id=t.id
      where t.credit_type = 'wellness_leave'
        and t.posting_date >= v_year_start
        and t.posting_date < (v_year_start + interval '1 year')::date
        and (
          (new.personnel_id is not null and t.personnel_id = new.personnel_id)
          or (new.non_teaching_personnel_id is not null and t.non_teaching_personnel_id = new.non_teaching_personnel_id)
        );

      v_current := greatest(0, round(5 - v_wellness_used, 4));
      if new.service_credits_used > v_current then
        raise exception 'Insufficient annual Wellness Leave balance (5 days per calendar year).';
      end if;

      new.service_credits_earned := 0;
      new.absence_days := 0;
      new.previous_balance := v_current;
      new.balance_after := round(v_current - new.service_credits_used, 4);
      return new;
    end if;

    select t.balance_after
      into v_current
    from public.service_credit_transactions t
    where t.credit_type = new.credit_type
      and (
        (new.personnel_id is not null and t.personnel_id = new.personnel_id)
        or
        (new.non_teaching_personnel_id is not null and t.non_teaching_personnel_id = new.non_teaching_personnel_id)
      )
    order by t.ledger_sequence desc
    limit 1;

    v_current := coalesce(v_current, 0);

    if new.transaction_kind = 'credit' then
      if new.service_credits_earned <= 0 then
        raise exception 'Credit amount must be greater than zero.';
      end if;
      new.service_credits_used := 0;
      new.absence_days := coalesce(new.absence_days, 0);
    elsif new.transaction_kind = 'debit' then
      if new.service_credits_used <= 0 then
        raise exception 'Deduction amount must be greater than zero.';
      end if;
      new.service_credits_earned := 0;
      new.absence_days := coalesce(new.absence_days, 0);
    else
      raise exception 'Manual service credit postings must be a credit or debit.';
    end if;

    new.previous_balance := v_current;
    new.balance_after := round(
      v_current + new.service_credits_earned - new.service_credits_used,
      4
    );

    if new.balance_after < 0 then
      raise exception 'Insufficient service credit balance.';
    end if;
  end if;

  return new;
end;
$function$
;
