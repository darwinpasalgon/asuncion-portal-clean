const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const read = (pathInRepo) => fs.readFileSync(path.join(__dirname, "..", pathInRepo), "utf8");

test("JHS readiness audit is read-only and administrator authenticated", () => {
  const src = read("app/api/admin/jhs-readiness/route.ts");
  assert.match(src, /export async function GET\(/);
  assert.doesNotMatch(src, /export async function POST\(/);
  assert.match(src, /hasAdminPermission\(token, "school_setup\.manage"\)/);
  assert.match(src, /hasAdminPermission\(token, "reports\.view"\)/);
  assert.match(src, /Cache-Control": "private, no-store"/);
  assert.doesNotMatch(src, /method:\s*"(?:POST|PUT|PATCH|DELETE)"/);
});

test("JHS summaries exclude Grade 7 exploratory TVE from missing learner major count", () => {
  const src = read("app/api/admin/jhs-readiness/route.ts");
  assert.match(src, /grade_level=gte\.7&grade_level=lte\.10/);
  assert.match(src, /gradeLevel === 7 \? 0 : learners\.filter/);
  assert.match(src, /grade7_tve_rotations/);
  assert.match(src, /grade7RotationsComplete/);
});

test("Reports account for exact matching TVE teacher specialization, current month attendance and published grades", () => {
  const src = read("app/api/admin/jhs-readiness/route.ts");
  assert.match(src, /text\(assignment\.major\) === text\(row\.tve_major\)/);
  assert.match(src, /unmatchedMajors/);
  assert.match(src, /enrollment_status=eq\.active/);
  assert.match(src, /attendance_date=gte/);
  assert.match(src, /attendanceDays: new Set/);
  assert.match(src, /row\.status === "published"/);
  assert.match(src, /row\.status === "draft"/);
  assert.match(src, /unscheduledAssignments:/);
});

test("Admin dashboard links to JHS readiness with section follow-up tools", () => {
  const src = read("app/portal/admin/jhs-readiness/page.tsx");
  const home = read("app/portal/page.tsx");
  assert.match(src, /Grades 7–10 Readiness/);
  assert.match(src, /Read-Only Audit/);
  assert.match(src, /\/portal\/admin\/learners\?grade=/);
  assert.match(src, /\/portal\/admin\/teaching\?focus=subject-teacher/);
  assert.match(src, /\/portal\/attendance\?section=/);
  assert.match(src, /\/portal\/sf9/);
  assert.match(home, /href="\/portal\/admin\/jhs-readiness"/);
});
