const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const read = (p) => fs.readFileSync(path.join(__dirname, "..", p), "utf8");

test("Grade 11 School Setup offers STEM once while preserving Medical and Engineering as electives", () => {
  const page = read("app/portal/admin/school-setup/page.tsx");
  const api = read("app/api/admin/academic-structure/route.ts");
  const sql = read("supabase/migrations/20261016133000_grade11_stem_elective_groups.sql");
  assert.match(page, /code: "STEM", name: "Academic · STEM"/);
  assert.doesNotMatch(page, /code: "STEM_MEDICAL", name:/);
  assert.doesNotMatch(page, /code: "STEM_ENGINEERING", name:/);
  assert.match(api, /"STEM", "BUSINESS_ENTREPRENEURSHIP"/);
  assert.match(api, /submittedCode === "STEM_MEDICAL"/);
  assert.match(sql, /update public.sections/);
  assert.match(sql, /set shs_program_code='STEM'/);
  assert.match(sql, /shs_elective_group/);
  assert.match(sql, /STEM_MEDICAL','STEM_ENGINEERING/);
});

test("Medical or Engineering learner assignment is admin-only and does not move learners", () => {
 const api = read("app/api/admin/stem-elective-groups/route.ts");
 const page = read("app/portal/admin/stem-elective-groups/page.tsx");
 assert.match(api, /hasAdminPermission\(token, "school_setup.manage"\)/);
 assert.match(api, /shs_program_code=eq.STEM/);
 assert.match(api, /student_enrollments\?id=eq/);
 assert.match(api, /section_id=eq/);
 assert.match(api, /school_year_id=eq/);
 assert.match(api, /shs_elective_group: group \|\| null/);
 assert.doesNotMatch(api, /method: "DELETE"/);
 assert.match(page, /One STEM advisory section/);
 assert.match(page, /STEM_GROUPS.map/);
 assert.match(page, /Not Assigned/);
});

test("Subject teacher assignment differentiates STEM elective groups, not sections", () => {
 const api = read("app/api/admin/teaching-setup/route.ts");
 const page = read("app/portal/admin/teaching/page.tsx");
 assert.match(api, /stemElectiveOfferings/);
 assert.match(api, /validStemPairs/);
 assert.match(api, /isStemElective/);
 assert.match(api, /major = needsMajor \|\| isStemElective/);
 assert.match(page, /setupSection.shs_program_code === "STEM"/);
 assert.match(page, /stemElectiveOfferings.filter/);
 assert.match(page, /STEM Elective Group/);
 assert.match(page, /stemGroupLabel/);
});

test("Gradebook and SF9 prevent cross-group grades and publicly display only STEM", () => {
 const api = read("app/api/academic/grades/route.ts");
 const ui = read("app/portal/grades/page.tsx");
 const sf9 = read("app/api/academic/sf9/route.ts");
 assert.match(api, /enrollment.shs_elective_group === selectedAssignment.major/);
 assert.match(api, /enrollments\[0\].shs_elective_group !== selectedAssignment.major/);
 assert.match(ui, /item.shs_elective_group === selectedAssignment.major/);
 assert.match(ui, /item.shs_elective_group === selectedSubjectAssignment.major/);
 assert.match(sf9, /STEM: "STEM"/);
 assert.match(sf9, /STEM_MEDICAL: "STEM"/);
 assert.match(sf9, /STEM_ENGINEERING: "STEM"/);
 assert.match(sf9, /const electiveProgram = shsProgram === "STEM"/);
 assert.match(sf9, /candidate.major === stemGroup/);
 assert.match(sf9, /shs_elective_group: stemGroup/);
});
