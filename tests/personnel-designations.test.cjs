const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");

test("HR has a single searchable personnel designation page", () => {
  const page = read("app/portal/admin/personnel-designations/page.tsx");
  const portal = read("app/portal/page.tsx");
  const proxy = read("proxy.ts");

  assert.match(page, /list_designations/);
  assert.match(page, /designation_history/);
  assert.match(page, /Update Designation/);
  assert.match(page, /expected_position:/);
  assert.match(page, /nonTeachingPositions/);
  assert.match(page, /teachingPositions/);
  assert.match(portal, /\/portal\/admin\/personnel-designations/);
  assert.match(proxy, /\/portal\/admin\/personnel-designations", "hr\.manage"/);
});

test("Position changes are atomic and keep linked records synchronized", () => {
  const sql = read("supabase/migrations/20261015102500_atomic_personnel_designation_updates.sql");
  const service = read("supabase/functions/teacher-profiles/index.ts");

  assert.match(sql, /update public\.profiles/);
  assert.match(sql, /update public\.non_teaching_personnel/);
  assert.match(sql, /insert into public\.personnel_designation_history/);
  assert.match(sql, /p_expected_position/);
  assert.match(sql, /grant execute on function public\.hr_change_personnel_designation/);
  assert.match(service, /admin\.rpc\("hr_change_personnel_designation"/);
  const action = service.split('if (action === "change_designation")')[1]
    .split('if (action === "save_personnel_name")')[0];
  assert.doesNotMatch(action, /\.select\("id,full_name,position,portal_user_id"\)/);
});

test("Changing a position must not modify academic roles or assignments", () => {
  const sql = read("supabase/migrations/20261015102500_atomic_personnel_designation_updates.sql");
  assert.doesNotMatch(sql, /update public\.(?:teacher_assignments|grade_level_heads|student_enrollments)/);
  assert.doesNotMatch(sql, /set role\s*=/);
});

test("Designation controls are immediately visible on HR and employee profile pages", () => {
  const directory = read("app/portal/admin/personnel-designations/page.tsx");
  const teacher = read("app/portal/admin/teacher-profiles/page.tsx");
  const nonTeaching = read("app/portal/admin/non-teaching-profiles/page.tsx");
  const nonTeachingStyles = read("app/portal/admin/non-teaching-profiles/non-teaching-profiles.module.css");
  const teacherStyles = read("app/portal/admin/teacher-profiles/teacher-profiles.module.css");

  assert.match(directory, /setSelectedId\(\(current\) => current \|\|/);
  assert.match(directory, /params\.get\("personnel"\)/);
  assert.match(directory, /Change Designation/);
  assert.match(teacher, /designationShortcut/);
  assert.match(teacher, /className=\{styles\.designationPanel\}/);
  assert.match(teacher, /className=\{styles\.designationSave\}/);
  assert.match(teacher, /New Designation/);
  assert.match(nonTeaching, /className=\{styles\.designationPanel\}/);
  assert.match(nonTeaching, /designationShortcut/);
  assert.match(nonTeachingStyles, /\.designationShortcut\{/);
  assert.match(teacherStyles, /\.designationSave\{/);
});
