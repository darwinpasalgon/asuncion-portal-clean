drop policy if exists "Personnel read own service credit ledger" on public.service_credit_transactions;
drop policy if exists "HR reads all service credit ledgers" on public.service_credit_transactions;

create policy "Personnel and HR read service credit ledgers"
on public.service_credit_transactions
for select
to authenticated
using (
  personnel_id = (select auth.uid())
  or (select private.has_admin_permission('hr.manage'))
);

create index if not exists service_credit_transactions_created_by_idx
on public.service_credit_transactions(created_by);
