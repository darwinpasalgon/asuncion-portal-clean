const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

function read(file) {
  return fs.readFileSync(path.join(__dirname, "..", file), "utf8");
}

test("community migration adds school, grade, and section room scopes", () => {
  const sql = read("supabase/migrations/20261012091420_community_scoped_chatrooms.sql");
  assert.match(sql, /room_type text not null default 'school'/);
  assert.match(sql, /room_type = 'grade'/);
  assert.match(sql, /room_type = 'section'/);
  assert.match(sql, /community_room_read_state/);
  assert.match(sql, /community_room_unread_counts/);
});

test("community room access is enforced in RLS and message preparation", () => {
  const sql = read("supabase/migrations/20261012091420_community_scoped_chatrooms.sql");
  assert.match(sql, /private\.community_room_access/);
  assert.match(sql, /Members read accessible community rooms/);
  assert.match(sql, /Members send to accessible community rooms/);
  assert.match(sql, /community room access denied/);
  assert.match(sql, /v_role = 'administrator'/);
});

test("community API resolves scoped rooms and per-room read state", () => {
  const api = read("app/api/community/route.ts");
  assert.match(api, /accessibleRooms/);
  assert.match(api, /student_enrollments/);
  assert.match(api, /teacher_assignments/);
  assert.match(api, /section_advisers/);
  assert.match(api, /grade_level_heads/);
  assert.match(api, /community_room_read_state/);
  assert.match(api, /roomKey/);
});

test("community interface exposes room directory and super admin room view", () => {
  const page = read("app/portal/community/page.tsx");
  assert.match(page, /School-Wide/);
  assert.match(page, /Grade-Wide/);
  assert.match(page, /Sections/);
  assert.match(page, /Super Admin view · all rooms/);
  assert.match(page, /Section chats are limited to enrolled students and the assigned adviser/);
});

test("section chat access excludes subject teachers and grade heads", () => {
  const sql = read("supabase/migrations/20261012093413_community_section_adviser_only.sql");
  const api = read("app/api/community/route.ts");

  assert.match(sql, /if v_role = 'teacher'/);
  assert.match(sql, /return exists \(\s*select 1\s*from public\.section_advisers sa/s);
  assert.doesNotMatch(
    sql,
    /return\s+exists \(\s*select 1\s*from public\.teacher_assignments ta[\s\S]*?p_room_type = 'section'/
  );

  assert.match(api, /for \(const row of assignments \?\? \[\]\) \{\s*const grade = Number\(row\.grade_level\);\s*if \(Number\.isInteger\(grade\)\) allowedGrades\.add\(grade\);\s*\}/s);
  assert.match(api, /for \(const row of adviserRows \?\? \[\]\) \{\s*if \(row\.section_id\) allowedSections\.add\(String\(row\.section_id\)\);\s*\}/s);
});
