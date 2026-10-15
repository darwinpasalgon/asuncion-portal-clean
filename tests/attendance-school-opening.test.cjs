const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const read = (p) => fs.readFileSync(path.join(__dirname, "..", p), "utf8");

test("SY 2026–2027 attendance begins June 8 and supports June through current month", () => {
  const calendar = read("lib/attendance-calendar.ts");
  const route = read("app/api/academic/attendance/route.ts");
  const page = read("app/portal/attendance/page.tsx");
  assert.match(calendar, /ANHS_2026_OPENING_DAY = "2026-06-08"/);
  assert.match(calendar, /attendanceMonths/);
  assert.match(calendar, /attendanceMonthRange/);
  assert.match(calendar, /start: \`\$\{month\}-01\` < startDate \? startDate/);
  assert.match(route, /attendanceMonthRange\(pendingMonth, schoolStart, today\)/);
  assert.match(route, /dateRange\(monthStart, monthEnd\)/);
  assert.match(route, /attendance_date=lte\.\$\{monthEnd\}/);
  assert.match(route, /attendanceDate < schoolStart/);
  assert.match(page, /Attendance Months/);
  assert.match(page, /loadAttendanceMonth/);
  assert.match(page, /min=\{schoolStart\}/);
  assert.match(page, /Unrecorded does not mean absent/);
});

test("Administrators and SF2 respect June 8 and preserve original attendance records", () => {
  const admin = read("app/portal/admin/attendance/page.tsx");
  const adminRoute = read("app/api/admin/attendance/route.ts");
  const sf2 = read("app/api/academic/sf2/route.ts");
  const adviserRoute = read("app/api/academic/attendance/route.ts");
  assert.match(admin, /min=\{attendanceStartDate\(activeYear\)\}/);
  assert.match(adminRoute, /attendanceStart: attendanceStartDate\(year\)/);
  assert.match(sf2, /date >= attendanceStartDate\(activeYear\)/);
  assert.doesNotMatch(adviserRoute, /status:\s*"present"\s*[,}]/);
});
