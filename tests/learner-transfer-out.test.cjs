const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const read = (p) => fs.readFileSync(path.join(__dirname, "..", p), "utf8");

test("Transfer Out is a visible Learner Management action that removes learners from the current class list", () => {
  const page = read("app/portal/admin/learners/page.tsx");
  assert.match(page, /Transfer Out/);
  assert.match(page, /openStatus\(learner, enrollment, "transferred_out"\)/);
  assert.match(page, /statusFilter, setStatusFilter\] = useState\("currently_enrolled"\)/);
  assert.match(page, /enrollment\.enrollment_status !== "active"/);
  assert.match(page, /Confirm Transfer Out/);
  assert.match(page, /statusError &&/);
  assert.match(page, /expected_status: previous/);
});

test("Transfer Out changes enrollment, attendance roster, and history atomically without deleting records", () => {
  const sql = read("supabase/migrations/20261015113000_atomic_learner_status_transfer_out.sql");
  const api = read("supabase/functions/admin-learner-management/index.ts");
  assert.match(sql, /update public\.student_enrollments/);
  assert.match(sql, /insert into public\.learner_enrollment_events/);
  assert.match(sql, /p_status='transferred_out' then 'transferred'/);
  assert.match(sql, /when p_status='transferred_out' then 'transferred'/);
  assert.match(sql, /for update/);
  assert.match(sql, /grant execute on function public\.admin_change_learner_enrollment_status.*service_role/);
  assert.doesNotMatch(sql, /delete from public\.student_enrollments/);
  assert.doesNotMatch(sql, /delete from public\.profiles/);
  assert.match(api, /admin\.rpc\("admin_change_learner_enrollment_status"/);
  assert.match(api, /removed from the active class and attendance rosters/i);
});

test("Class counts and grades exclude transferred learners while SF2 preserves transfer remarks", () => {
  const students = read("app/api/academic/adviser-students/route.ts");
  const grades = read("app/api/academic/grades/route.ts");
  const sf2 = read("app/api/academic/sf2/route.ts");
  assert.match(students, /enrollment_status=eq\.active/);
  assert.match(grades, /enrollment_status=eq\.active/);
  assert.match(sf2, /enrollment\.learner_status\)\.toLowerCase\(\) === "transferred_out"/);
  assert.match(sf2, /TRANSFERRED OUT/);
});
