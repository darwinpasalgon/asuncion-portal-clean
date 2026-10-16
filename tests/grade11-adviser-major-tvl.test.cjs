const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const read = (p) => fs.readFileSync(path.join(__dirname, "..", p), "utf8");

test("Amber is one Grade 11 TVL section with separate Food Processing and Agriculture majors", () => {
 const migration = read("supabase/migrations/20261016150000_grade11_tvl_amber_adviser_major.sql");
 const school = read("app/portal/admin/school-setup/page.tsx");
 assert.match(migration, /name='Amber' and shs_program_code is null/);
 assert.match(migration, /shs_program_code='TVL'/);
 assert.match(migration, /TVL_FOOD_PROCESSING/);
 assert.match(migration, /TVL_OAP/);
 assert.match(school, /code: "TVL", name: "TVL · Combined Majors"/);
});

test("Grade 11 major may only be changed by its active section adviser, and graded assignments block reassignment", () => {
 const migration = read("supabase/migrations/20261016150000_grade11_tvl_amber_adviser_major.sql");
 const api = read("app/api/academic/adviser-students/route.ts");
 assert.match(migration, /auth\.uid\(\) is null/);
 assert.match(migration, /sa\.is_active=true/);
 assert.match(migration, /sa\.school_year_id=target\.school_year_id/);
 assert.match(migration, /sa\.section_id=target\.section_id/);
 assert.match(migration, /p\.role='teacher'/);
 assert.match(migration, /g\.student_id=target\.student_id/);
 assert.match(migration, /target\.shs_elective_group is distinct from normalized_group/);
 assert.match(migration, /revoke all on function public\.set_adviser_grade11_elective_group/);
 assert.match(migration, /grant execute on function public\.set_adviser_grade11_elective_group.*authenticated/);
 assert.match(api, /action === "set_grade11_major"/);
 assert.match(api, /rpc\/set_adviser_grade11_elective_group/);
});

test("My Students offers proper majors based on section, and dashboard alerts for missing STEM or TVL major", () => {
 const page = read("app/portal/my-students/page.tsx");
 const attention = read("app/api/academic/adviser-attention/route.ts");
 assert.match(page, /selected\.grade_level === 11/);
 assert.match(page, /selected\.section_program === "STEM" \? "STEM Major" : "TVL Major"/);
 assert.match(page, /groupsForSectionProgram\(selected\.section_program\)/);
 assert.match(page, /action: "set_grade11_major"/);
 assert.match(attention, /shs_elective_group/);
 assert.match(attention, /missingFields\.push\("STEM Major"\)/);
 assert.match(attention, /missingFields\.push\("TVL Major"\)/);
 assert.match(attention, /\/portal\/my-students\?student=/);
});

test("Grade 11 TVL majors reach gradebook and SF9 without splitting section or exposing other group's grades", () => {
 const grades = read("app/api/academic/grades/route.ts");
 const ui = read("app/portal/grades/page.tsx");
 const sf9 = read("app/api/academic/sf9/route.ts");
 const teaching = read("app/api/admin/teaching-setup/route.ts");
 assert.match(grades, /TVL_OAP/);
 assert.match(grades, /TVL_FOOD_PROCESSING/);
 assert.match(grades, /item\.major === ownEnrollment\.shs_elective_group/);
 assert.match(ui, /isGrade11ElectiveGroup/);
 assert.match(sf9, /sectionProgram === "TVL"/);
 assert.match(sf9, /electiveProgram/);
 assert.match(sf9, /candidate\.major === stemGroup/);
 assert.match(teaching, /program_code=in\.\(STEM_MEDICAL,STEM_ENGINEERING,TVL_OAP,TVL_FOOD_PROCESSING\)/);
 assert.match(teaching, /row\.program_code\.startsWith\("TVL_"\)/);
});
