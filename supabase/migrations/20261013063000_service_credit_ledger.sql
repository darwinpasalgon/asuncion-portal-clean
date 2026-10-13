create table public.service_credit_transactions (
  id uuid primary key default gen_random_uuid(),
  ledger_sequence bigint generated always as identity unique,
  personnel_id uuid not null references public.profiles(id) on delete restrict,
  credit_type text not null default 'service_credit'
    check (credit_type in ('service_credit','wellness_leave')),
  posting_date date not null,
  transaction_kind text not null
    check (transaction_kind in ('opening_balance','credit','debit','mixed','absence','adjustment')),
  previous_balance numeric(10,2),
  service_credits_earned numeric(10,2) not null default 0
    check (service_credits_earned >= 0),
  particulars text not null
    check (char_length(btrim(particulars)) between 1 and 1000),
  absence_days numeric(10,2) not null default 0
    check (absence_days >= 0),
  service_credits_used numeric(10,2) not null default 0
    check (service_credits_used >= 0),
  balance_after numeric(10,2) not null,
  remarks text check (remarks is null or char_length(remarks) <= 1000),
  source text not null default 'manual'
    check (source in ('manual','excel_import')),
  source_file text,
  source_sheet text,
  source_row integer check (source_row is null or source_row > 0),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  check (
    transaction_kind = 'opening_balance'
    or service_credits_earned > 0
    or service_credits_used > 0
    or absence_days > 0
  )
);

create unique index service_credit_transactions_source_row_uidx
on public.service_credit_transactions(personnel_id, source_file, source_sheet, source_row)
where source = 'excel_import'
  and source_file is not null
  and source_sheet is not null
  and source_row is not null;

create index service_credit_transactions_personnel_ledger_idx
on public.service_credit_transactions(personnel_id, credit_type, ledger_sequence desc);

create index service_credit_transactions_personnel_date_idx
on public.service_credit_transactions(personnel_id, credit_type, posting_date desc);

alter table public.service_credit_transactions enable row level security;

grant select, insert on public.service_credit_transactions to authenticated;
grant usage, select on sequence public.service_credit_transactions_ledger_sequence_seq to authenticated;

create policy "Personnel read own service credit ledger"
on public.service_credit_transactions
for select
to authenticated
using (personnel_id = (select auth.uid()));

create policy "HR reads all service credit ledgers"
on public.service_credit_transactions
for select
to authenticated
using ((select private.has_admin_permission('hr.manage')));

create policy "HR posts service credit transactions"
on public.service_credit_transactions
for insert
to authenticated
with check (
  (select private.has_admin_permission('hr.manage'))
  and created_by = (select auth.uid())
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
  v_current numeric(10,2);
begin
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

  if new.source = 'manual' then
    perform pg_advisory_xact_lock(
      hashtextextended(new.personnel_id::text || ':' || new.credit_type, 0)
    );

    select t.balance_after
      into v_current
    from public.service_credit_transactions t
    where t.personnel_id = new.personnel_id
      and t.credit_type = new.credit_type
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
      2
    );

    if new.balance_after < 0 then
      raise exception 'Insufficient service credit balance.';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.prepare_service_credit_transaction() from public;

create trigger prepare_service_credit_transaction_before_insert
before insert on public.service_credit_transactions
for each row execute function private.prepare_service_credit_transaction();
