-- Independently calculate and enforce five Wellness Leave days per calendar year.
-- Existing imported Wellness Leave debits count toward the year's five-day allowance.
-- Nothing changes historical Service Credits transactions.
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
      select coalesce(sum(t.service_credits_used), 0)
        into v_wellness_used
      from public.service_credit_transactions t
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
$$;
