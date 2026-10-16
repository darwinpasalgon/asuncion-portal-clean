const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const read = (p) => fs.readFileSync(path.join(__dirname, "..", p), "utf8");

test("Grade 11 layout uses exact core-subject row order and communication subrows from official workbook", () => {
 const helper = read("lib/sf9-grade11-layout.ts");
 const coreStart = helper.indexOf("GRADE11_SF9_CORE_ORDER = [");
 const coreEnd = helper.indexOf("] as const;", coreStart);
 assert.ok(coreStart >= 0 && coreEnd > coreStart);
 const coreNames = helper.slice(coreStart, coreEnd);
 let last = -1;
 for (const label of [
   "Effective Communication", "Mabisang Komunikasyon", "General Mathematics",
   "General Science", "Life and Career Skills",
   "Pag-Aaral ng Kasanayan at Lipunang Pilipino",
 ]) {
   const next = coreNames.indexOf('"' + label + '"', last + 1);
   assert.ok(next > last, "Core subject out of workbook order: " + label);
   last = next;
 }
 assert.match(helper, /heading\("shs11-core-heading", "Core Subjects"/);
 assert.match(helper, /heading\("shs11-language-heading", GRADE11_COMMUNICATION_LABEL/);
 assert.match(helper, /heading\("shs11-elective-heading", "Elective Subjects"/);
 assert.match(helper, /Social Science Theory and Practice/);
 assert.match(helper, /Academic Elective 2/);
 assert.match(helper, /Academic Elective 3/);
 assert.match(helper, /shs11-elective-.*termNo/);
 assert.match(helper, /terms\[termNo - 1\] = source\?\.terms\?\.\[termNo - 1\]/);
});

test("The Grade 11 table matches the workbook while retaining Grade 7-10 JHS rows", () => {
 const template = read("app/portal/sf9/Sf9PrintForms.tsx");
 const css = read("app/portal/sf9/sf9.module.css");
 assert.match(template, /card\.grade_level === 11\s*\? sf9Grade11Rows/);
 assert.match(template, /: padGradeRows\(card\.grade_rows\)/);
 assert.match(template, /styles\.shsSectionRow/);
 assert.match(template, /styles\.shsGroupLabelRow/);
 assert.match(template, /styles\.shsIndentedRow/);
 assert.match(css, /\.grade11Table/);
 assert.match(css, /\.shsIndentedRow td:first-child/);
 assert.match(template, /<th colSpan=\{3\}>TERM<\/th>/);
 assert.match(template, /<th>T1<\/th>/);
 assert.match(template, /<th>T2<\/th>/);
 assert.match(template, /<th>T3<\/th>/);
});

test("Grade 11 elective names use student program and term, not a fixed ASSH label across tracks", () => {
 const api = read("app/api/academic/sf9/route.ts");
 const helper = read("lib/sf9-grade11-layout.ts");
 const rls = read("supabase/migrations/20261016104700_shs_adviser_offerings_sf9.sql");
 assert.match(api, /shs_strand_program/);
 assert.match(api, /shs_track/);
 assert.match(api, /shs_subject_offerings\?school_year_id=eq/);
 assert.match(api, /program_code=eq|offer\.program_code === shsProgram/);
 assert.match(api, /shs_program_code: shsProgram/);
 assert.match(api, /elective_offerings: electiveOfferings/);
 assert.match(helper, /electiveOfferings\.filter/);
 assert.match(helper, /programCode === "ASSH"/);
 assert.match(rls, /sa\.teacher_id=\(select auth\.uid\(\)\)/);
 assert.match(rls, /sa\.school_year_id=shs_subject_offerings\.school_year_id/);
 assert.match(rls, /s\.grade_level=shs_subject_offerings\.grade_level/);
});
