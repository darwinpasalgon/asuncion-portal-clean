const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

function read(file) {
  return fs.readFileSync(path.join(__dirname, "..", file), "utf8");
}

test("SF2 includes learners who have official attendance before their portal import date", () => {
  const route = read("app/api/academic/sf2/route.ts");

  assert.match(route, /const attendanceStudentIds = new Set\(/);
  assert.match(
    route,
    /portalEnrollmentDate <= cutoff \|\|\s*attendanceStudentIds\.has\(String\(row\.student_id\)\)/s
  );
});

test("SF2 uses earlier official attendance instead of the later bulk-import timestamp", () => {
  const route = read("app/api/academic/sf2/route.ts");

  assert.match(route, /function earliestDate/);
  assert.match(route, /const firstRecordedAttendanceDate =\s*rows\.map\(\(row\) => row\.attendance_date\)\.sort\(\)\[0\] \?\? null/s);
  assert.match(
    route,
    /const effectiveInDate =\s*transferInDate \|\|\s*earliestDate\(portalEnrollmentDate, firstRecordedAttendanceDate\)/s
  );
});
