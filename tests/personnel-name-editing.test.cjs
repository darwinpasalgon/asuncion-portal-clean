const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

function read(file) {
  return fs.readFileSync(path.join(__dirname, "..", file), "utf8");
}

test("personnel can edit their own structured name but learners are blocked", () => {
  const fn = read("supabase/functions/teacher-profiles/index.ts");
  const page = read("app/portal/profile/page.tsx");

  assert.match(fn, /action === "get_name"/);
  assert.match(fn, /action === "save_name"/);
  assert.match(fn, /Learner names cannot be edited from My Profile/);
  assert.match(fn, /caller\.role === "student" \|\| caller\.requested_role === "student"/);
  assert.match(page, /profile\.role !== "student"/);
  assert.match(page, /Save Name/);
  assert.match(page, /Learner names remain locked from learner accounts/);
});

test("personnel name changes synchronize portal display names", () => {
  const fn = read("supabase/functions/teacher-profiles/index.ts");

  assert.match(fn, /teacherDisplayName/);
  assert.match(fn, /from\("profiles"\)[\s\S]*update\(\{ full_name: displayName/);
  assert.match(fn, /from\("non_teaching_personnel"\)[\s\S]*full_name: displayName/);
  assert.match(fn, /from\("teacher_information"\)[\s\S]*personal: merged/);
});

test("HR can correct names separately from incomplete personnel profiles", () => {
  const fn = read("supabase/functions/teacher-profiles/index.ts");
  const nonTeaching = read("app/portal/admin/non-teaching-profiles/page.tsx");
  const teachers = read("app/portal/admin/teacher-profiles/page.tsx");

  assert.match(fn, /action === "save_personnel_name"/);
  assert.match(fn, /if \(!canManage\) return json\(\{ error: "Human Resources access required\."/);
  assert.match(nonTeaching, /action: "save_personnel_name"/);
  assert.match(nonTeaching, /Other incomplete profile fields were left unchanged/);
  assert.match(teachers, /action: "save_personnel_name"/);
  assert.match(teachers, /Other incomplete profile fields were left unchanged/);
});

test("personnel name editing requires first and last name", () => {
  const fn = read("supabase/functions/teacher-profiles/index.ts");

  assert.match(fn, /!normalizedName\.first_name \|\| !normalizedName\.last_name/);
  assert.match(fn, /First Name and Last Name are required/);
});
