const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const read = (p) => fs.readFileSync(path.join(__dirname, "..", p), "utf8");

test("SF9 supports Grades 7–12 while restricting advisers to their assigned active section", () => {
 const source = read("app/api/academic/sf9/route.ts");
 assert.match(source, /grade_level=gte\.7&grade_level=lte\.12/);
 assert.match(source, /adviserRows\.map\(\(row\) => String\(row\.section_id\)\)/);
 assert.match(source, /\.filter\(\(id\) => activeSectionIds\.has\(id\)\)/);
 assert.match(source, /if \(sectionId && !allowedSectionIds\.has\(sectionId\)\)/);
});

test("SF2 uses own active adviser sections with a secure intersection and never silently hides a fetch failure", () => {
 const source = read("app/api/academic/sf2/route.ts");
 assert.match(source, /section_advisers\?school_year_id=eq/);
 assert.match(source, /teacher_id=eq/);
 assert.match(source, /const sectionIds = new Set<string>/);
 assert.match(source, /sectionIds\.has\(String\(row\.id\)\)/);
 assert.doesNotMatch(source, /\)&is_active=eq\.true&select=section_id\`,\s*token\s*\)\.catch\(\(\) => \[\]\)/);
});

test("SF10 adviser list returns assigned sections including sections with no enrolled students", () => {
 const edge = read("supabase/functions/registrar-sf10/index.ts");
 const ui = read("app/portal/admin/sf10/page.tsx");
 assert.match(edge, /sections: advisorySections \?\? \[\], students: \[\]/);
 assert.match(edge, /sections: advisorySections \?\? \[\],/);
 assert.match(edge, /caller\.adviserSectionIds/);
 assert.match(ui, /Advisory Section/);
 assert.match(ui, /No enrolled learners in this advisory section yet/);
 assert.match(ui, /student\.section === target\.name && student\.grade_level === target\.grade_level/);
 assert.doesNotMatch(ui, /if \(!needle\) return students/);
});
