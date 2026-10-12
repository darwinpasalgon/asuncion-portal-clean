const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

function read(file) {
  return fs.readFileSync(path.join(__dirname, "..", file), "utf8");
}

test("section program type migration preserves JHS and classifies known Grade 12 sections", () => {
  const sql = read("supabase/migrations/20261012083825_add_section_program_type.sql");
  assert.match(sql, /add column if not exists program_type text/);
  assert.match(sql, /grade_level = 0/);
  assert.match(sql, /'ALS A&E'/);
  assert.match(sql, /lower\(trim\(name\)\) = 'courage'/);
  assert.match(sql, /'ALS-SHS'/);
  assert.match(sql, /'Regular SHS'/);
  assert.match(sql, /grade_level between 7 and 10 and program_type is null/);
});

test("school setup reads and manages Senior High section program type", () => {
  const api = read("app/api/admin/academic-structure/route.ts");
  const page = read("app/portal/admin/school-setup/page.tsx");
  assert.match(api, /select=id,grade_level,name,is_active,program_type/);
  assert.match(api, /set_section_program_type/);
  assert.match(api, /Select Regular SHS or ALS-SHS/);
  assert.match(page, /Program Type/);
  assert.match(page, /Regular SHS/);
  assert.match(page, /ALS-SHS/);
});

test("learner import blocks unclassified Senior High sections on client and server", () => {
  const page = read("app/portal/admin/masterlist/page.tsx");
  const edge = read("supabase/functions/admin-bulk-account-import/index.ts");
  assert.match(page, /seniorHighProgramReady/);
  assert.match(page, /Set this Senior High section's Program Type in School Setup/);
  assert.match(edge, /select\("id,name,program_type"\)/);
  assert.match(edge, /Set this Senior High section's Program Type in School Setup before importing learners/);
});
