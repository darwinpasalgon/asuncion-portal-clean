alter table public.service_credit_transactions
drop constraint if exists service_credit_transactions_check;

alter table public.service_credit_transactions
add constraint service_credit_transactions_check
check (
  transaction_kind in ('opening_balance','adjustment')
  or service_credits_earned > 0
  or service_credits_used > 0
  or absence_days > 0
);
