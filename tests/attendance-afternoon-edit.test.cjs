const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

function read(file) {
  return fs.readFileSync(path.join(__dirname, "..", file), "utf8");
}

test("attendance supports Absent in the Afternoon for advisers and assistants", () => {
  const api = read("app/api/academic/attendance/route.ts");
  const page = read("app/portal/attendance/page.tsx");
  const admin = read("app/portal/admin/attendance/page.tsx");

  assert.match(api, /"absent_afternoon"/);
  assert.match(page, /Absent in the Afternoon/);
  assert.match(page, /value="absent_afternoon"/);
  assert.match(page, /assistantAbsentAfternoon/);
  assert.match(admin, /absent_afternoon:"Absent in the Afternoon"/);
});

test("SF2 renders morning and afternoon half-day absences with opposite half shading", () => {
  const route = read("app/api/academic/sf2/route.ts");
  const form = read("app/portal/sf2/Sf2PrintForm.tsx");

  assert.match(
    route,
    /row\.status === "absent_morning"[\s\S]*state: "absent_morning"/
  );
  assert.match(
    route,
    /row\.status === "absent_afternoon"[\s\S]*state: "absent_afternoon"/
  );
  assert.match(
    form,
    /state === "absent_morning" \? "sf2-half-upper"/
  );
  assert.match(
    form,
    /state === "absent_afternoon" \? "sf2-half-lower"/
  );
});

test("advisers can correct already saved attendance for today or prior weekdays", () => {
  const api = read("app/api/academic/attendance/route.ts");
  const page = read("app/portal/attendance/page.tsx");

  assert.match(api, /attendanceDate > manilaToday\(\)/);
  assert.doesNotMatch(api, /attendanceDate !== manilaToday\(\).*save_attendance/s);
  assert.match(
    api,
    /daily_attendance\?on_conflict=student_id,school_year_id,attendance_date/
  );
  assert.match(api, /resolution=merge-duplicates/);
  assert.match(page, /isEditingSavedAttendance/);
  assert.match(page, /Update Attendance/);
  assert.match(page, /existing records will be updated, not duplicated/i);
});

test("database migration allows afternoon absence in official and assistant attendance", () => {
  const migration = read(
    "supabase/migrations/20261014105852_add_absent_afternoon_attendance_status.sql"
  );

  assert.match(migration, /daily_attendance_status_check/);
  assert.match(migration, /attendance_assistant_entries_status_check/);
  assert.match(migration, /'absent_afternoon'/);
  assert.match(migration, /Attendance assistants update section entries/);
});
