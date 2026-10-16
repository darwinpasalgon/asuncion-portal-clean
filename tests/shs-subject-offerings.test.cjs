const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const read = (p) => fs.readFileSync(path.join(__dirname, "..", p), "utf8");

test("Grade 11 core curriculum groups communication alternatives and other core subjects", () => {
  const sql = read("supabase/migrations/20261016091000_grade11_shs_subject_offerings.sql");
  for (const name of [
    "Effective Communication", "Mabisang Komunikasyon", "General Mathematics",
    "General Science", "Life and Career Skills", "Pag-Aaral ng Kasanayan at Lipunang Pilipino",
  ]) assert.ok(sql.includes(name), "Missing core subject: " + name);
  assert.match(sql, /Effective Communication \/ Mabisang Komunikasyon/);
  assert.match(sql, /on conflict \(grade_level,name\)/);
  assert.match(sql, /grade_level=11/);
});

test("SHS offerings protect database access and preserve historic student records", () => {
  const sql = read("supabase/migrations/20261016091000_grade11_shs_subject_offerings.sql");
  const api = read("app/api/admin/shs-subjects/route.ts");
  assert.match(sql, /enable row level security/);
  assert.match(sql, /private\.has_admin_permission\('teaching\.manage'/);
  assert.match(sql, /revoke all on public\.shs_subject_offerings from anon/);
  assert.match(sql, /grade_level in \(11,12\)/);
  assert.match(sql, /term_no between 1 and case when grade_level=11 then 3 else 2 end/);
  assert.match(api, /hasAdminPermission\(token, "teaching\.manage"\)/);
  assert.match(api, /action === "remove_offering"/);
  assert.match(api, /is_active: false/);
  assert.doesNotMatch(api, /delete from|method: "DELETE"|case "delete"/i);
  assert.match(api, /resolution=merge-duplicates/);
});

test("SHS setup has term, core, Academic/TVL program and manual additions/removals", () => {
  const page = read("app/portal/admin/shs-subjects/page.tsx");
  const teaching = read("app/portal/admin/teaching/page.tsx");
  assert.match(page, /Grade 11/);
  assert.match(page, /Grade 12/);
  assert.match(page, /Core Subjects/);
  assert.match(page, /Program Electives/);
  assert.match(page, /STEM_MEDICAL/);
  assert.match(page, /STEM_ENGINEERING/);
  assert.match(page, /BUSINESS_ENTREPRENEURSHIP/);
  assert.match(page, /ASSH/);
  assert.match(page, /TVL_OAP/);
  assert.match(page, /TVL_FOOD_PROCESSING/);
  assert.match(page, /Add to Subject Setup/);
  assert.match(page, /remove_offering/);
  assert.match(teaching, /href="\/portal\/admin\/shs-subjects"/);
});
