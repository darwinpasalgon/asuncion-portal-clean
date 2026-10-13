const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

function read(file) {
  return fs.readFileSync(path.join(__dirname, "..", file), "utf8");
}

test("Service Credits can belong to active non-teaching personnel without portal accounts", () => {
  const migration = read("supabase/migrations/20261013104417_service_credits_unlinked_non_teaching.sql");
  const fn = read("supabase/functions/service-credits/index.ts");

  assert.match(migration, /non_teaching_personnel_id uuid/);
  assert.match(migration, /num_nonnulls\(personnel_id, non_teaching_personnel_id\) = 1/);
  assert.match(migration, /Active Non-Teaching Personnel record not found/);
  assert.match(fn, /non_teaching_personnel/);
  assert.match(fn, /id: `nt:\$\{person\.id\}`/);
  assert.match(fn, /role: "non_teaching_personnel"/);
});

test("HR can post to an unlinked non-teaching Service Credits ledger", () => {
  const fn = read("supabase/functions/service-credits/index.ts");

  assert.match(fn, /const isNonTeaching = personnelToken\.startsWith\("nt:"\)/);
  assert.match(fn, /personnel_id: isNonTeaching \? null : personnelId/);
  assert.match(fn, /non_teaching_personnel_id: isNonTeaching \? personnelId : null/);
  assert.match(fn, /loadNonTeachingLedger/);
});

test("linked non-teaching personnel can later read their imported ledger", () => {
  const migration = read("supabase/migrations/20261013104417_service_credits_unlinked_non_teaching.sql");
  const fn = read("supabase/functions/service-credits/index.ts");

  assert.match(migration, /nt\.portal_user_id = \(select auth\.uid\(\)\)/);
  assert.match(fn, /portal_user_id", profileId/);
  assert.match(fn, /loadSelfLedger/);
});

test("Service Credits preserve up to four decimal places", () => {
  const migration = read("supabase/migrations/20261013104417_service_credits_unlinked_non_teaching.sql");
  const adminPage = read("app/portal/admin/service-credits/page.tsx");
  const selfPage = read("app/portal/service-credits/page.tsx");

  assert.match(migration, /previous_balance type numeric\(12,4\)/);
  assert.match(migration, /balance_after type numeric\(12,4\)/);
  assert.match(migration, /round\([\s\S]*,\s*4\s*\)/);
  assert.match(adminPage, /maximumFractionDigits: 4/);
  assert.match(selfPage, /maximumFractionDigits: 4/);
});
