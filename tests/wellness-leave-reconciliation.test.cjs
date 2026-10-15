const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");

test("Excel-imported Wellness Leave source remains immutable while missing USED cells receive independently audited corrections",()=>{
 const migration=read("supabase/migrations/20261015204500_reconcile_excel_wellness_balances.sql");
 assert.match(migration,/create table if not exists public.service_credit_wellness_reconciliations/);
 assert.match(migration,/transaction_id uuid primary key references public.service_credit_transactions\(id\)/);
 assert.match(migration,/alter table public.service_credit_wellness_reconciliations enable row level security/);
 assert.match(migration,/revoke all on public.service_credit_wellness_reconciliations from anon,authenticated/);
 assert.match(migration,/CABANAS, BEDA D/);
 assert.match(migration,/CABANAS, JOSUE C/);
 assert.match(migration,/LACADIN, GERELYN DIANE A/);
 assert.match(migration,/corrected_used_days/);
 assert.doesNotMatch(migration,/update public.service_credit_transactions/);
 assert.doesNotMatch(migration,/delete from public.service_credit_transactions/);
});

test("Annual five-day deduction validator honors reconciled Excel used days, not imported blank",()=>{
 const migration=read("supabase/migrations/20261015204500_reconcile_excel_wellness_balances.sql");
 const fn=read("supabase/functions/service-credits/index.ts");
 assert.match(migration,/sum\(coalesce\(w.corrected_used_days,t.service_credits_used\)\)/);
 assert.match(migration,/left join public.service_credit_wellness_reconciliations w on w.transaction_id=t.id/);
 assert.match(migration,/Insufficient annual Wellness Leave balance/);
 assert.match(fn,/service_credit_wellness_reconciliations/);
 assert.match(fn,/service_credits_used: Number\(correction.corrected_used_days\)/);
 assert.match(fn,/wellness_original_used: Number\(correction.original_used_days\)/);
 assert.match(fn,/wellness_reconciled: true/);
 assert.match(fn,/wellness_leave_balance: wellnessBalance/);
 assert.match(fn,/Math.max\(0, Math.round\(\(5 - wellnessUsed\)/);
});

test("Both admin and personnel wellness history expose source reconciliation but keep Service Credits separate",()=>{
 const admin=read("app/portal/admin/service-credits/page.tsx");
 const self=read("app/portal/service-credits/page.tsx");
 for (const page of [admin,self]){
  assert.match(page,/wellness_reconciled\?: boolean/);
  assert.match(page,/Excel Balance Reconciled/);
  assert.match(page,/item.service_credits_used/);
  assert.match(page,/wellnessRunningBalances/);
 }
 assert.match(admin,/wellness_leave_balance/);
 assert.match(self,/wellness_leave_balance/);
});
