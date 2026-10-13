alter table public.service_credit_transactions
  alter column personnel_id drop not null,
  alter column previous_balance type numeric(12,4),
  alter column service_credits_earned type numeric(12,4),
  alter column absence_days type numeric(12,4),
  alter column service_credits_used type numeric(12,4),
  alter column balance_after type numeric(12,4);

alter table public.service_credit_transactions
  add column if not exists non_teaching_personnel_id uuid
  references public.non_teaching_personnel(id) on delete restrict;

alter table public.service_credit_transactions
  drop constraint if exists service_credit_transactions_owner_check;

alter table public.service_credit_transactions
  add constraint service_credit_transactions_owner_check
  check (num_nonnulls(personnel_id, non_teaching_personnel_id) = 1);

drop index if exists public.service_credit_transactions_source_row_uidx;

create unique index if not exists service_credit_transactions_profile_source_row_uidx
on public.service_credit_transactions(personnel_id, source_file, source_sheet, source_row)
where personnel_id is not null
  and source = 'excel_import'
  and source_file is not null
  and source_sheet is not null
  and source_row is not null;

create unique index if not exists service_credit_transactions_nt_source_row_uidx
on public.service_credit_transactions(non_teaching_personnel_id, source_file, source_sheet, source_row)
where non_teaching_personnel_id is not null
  and source = 'excel_import'
  and source_file is not null
  and source_sheet is not null
  and source_row is not null;

create index if not exists service_credit_transactions_nt_ledger_idx
on public.service_credit_transactions(non_teaching_personnel_id, credit_type, ledger_sequence desc);

create index if not exists service_credit_transactions_nt_date_idx
on public.service_credit_transactions(non_teaching_personnel_id, credit_type, posting_date desc);

drop policy if exists "Personnel and HR read service credit ledgers"
on public.service_credit_transactions;

create policy "Personnel and HR read service credit ledgers"
on public.service_credit_transactions
for select
to authenticated
using (
  personnel_id = (select auth.uid())
  or exists (
    select 1
    from public.non_teaching_personnel nt
    where nt.id = non_teaching_personnel_id
      and nt.portal_user_id = (select auth.uid())
      and nt.is_active = true
  )
  or (select private.has_admin_permission('hr.manage'))
);

create or replace function private.prepare_service_credit_transaction()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_requested_role text;
  v_nt_active boolean;
  v_current numeric(12,4);
  v_owner_key text;
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
      hashtextextended(v_owner_key || ':' || new.credit_type, 0)
    );

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
$$;

revoke all on function private.prepare_service_credit_transaction() from public;
