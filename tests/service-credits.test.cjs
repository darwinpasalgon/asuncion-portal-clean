const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

function read(file) {
  return fs.readFileSync(path.join(__dirname, "..", file), "utf8");
}

test("service credit ledger stores running balances and immutable history", () => {
  const migration = read("supabase/migrations/20261013063000_service_credit_ledger.sql");

  assert.match(migration, /create table public\.service_credit_transactions/);
  assert.match(migration, /ledger_sequence bigint generated always as identity/);
  assert.match(migration, /previous_balance numeric\(10,2\)/);
  assert.match(migration, /balance_after numeric\(10,2\) not null/);
  assert.match(migration, /source in \('manual','excel_import'\)/);
  assert.match(migration, /alter table public\.service_credit_transactions enable row level security/);
  assert.doesNotMatch(migration, /grant update|grant delete/i);
});

test("personnel can read only their own service credit ledger while HR can manage it", () => {
  const migration = read("supabase/migrations/20261013063000_service_credit_ledger.sql");
  const fn = read("supabase/functions/service-credits/index.ts");

  assert.match(migration, /personnel_id = \(select auth\.uid\(\)\)/);
  assert.match(migration, /private\.has_admin_permission\('hr\.manage'\)/);
  assert.match(fn, /Human Resources access required/);
  assert.match(fn, /administrator_permissions/);
  assert.match(fn, /permission", "hr\.manage"/);
});

test("manual postings automatically compute the new balance and block overdrafts", () => {
  const migration = read("supabase/migrations/20261013063000_service_credit_ledger.sql");

  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, /new\.previous_balance := v_current/);
  assert.match(migration, /v_current \+ new\.service_credits_earned - new\.service_credits_used/);
  assert.match(migration, /Insufficient service credit balance/);
});

test("HR interface provides add and deduct actions and transaction history", () => {
  const page = read("app/portal/admin/service-credits/page.tsx");
  const proxy = read("proxy.ts");

  assert.match(page, /Add Service Credits/);
  assert.match(page, /Deduct Service Credits/);
  assert.match(page, /Transaction History/);
  assert.match(page, /Available Balance/);
  assert.match(proxy, /\/portal\/admin\/service-credits", "hr\.manage"/);
});

test("personnel dashboard shows Service Credits and links to their own ledger", () => {
  const portal = read("app/portal/page.tsx");
  const selfPage = read("app/portal/service-credits/page.tsx");

  assert.match(portal, /My Service Credits/);
  assert.match(portal, /service_credit_balance/);
  assert.match(portal, /\/portal\/service-credits/);
  assert.match(selfPage, /My Service Credits/);
  assert.match(selfPage, /Wellness Leave/);
});

test("learners are excluded from Service Credits access", () => {
  const fn = read("supabase/functions/service-credits/index.ts");
  const proxy = read("proxy.ts");

  assert.match(fn, /Service Credits are available to personnel accounts only/);
  assert.match(proxy, /serviceCreditsPage && state\.role === "student"/);
});
