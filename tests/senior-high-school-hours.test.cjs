const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");

test("Senior High 4:45 PM cutoff, Junior High 4:30 PM cutoff, and shared validation",()=>{
  const hours=read("lib/schedule-hours.ts");
  assert.match(hours,/JUNIOR_HIGH_DAY_END = "16:30"/);
  assert.match(hours,/SENIOR_HIGH_DAY_END = "16:45"/);
  assert.match(hours,/Number\(gradeLevel\) >= 11 && Number\(gradeLevel\) <= 12/);
  assert.match(hours,/endTime <= schoolDayEnd\(gradeLevel\)/);
  const route=read("app/api/admin/class-schedules/route.ts");
  const ui=read("app/portal/admin/schedules/page.tsx");
  assert.match(route,/validSchoolTimeRange\(startTime, endTime, Number\(assignmentRows\[0\].grade_level\)\)/);
  assert.match(ui,/validSchoolTimeRange\(draft.startTime, draft.endTime, assignment.grade_level\)/);
  assert.match(ui,/validSchoolTimeRange\(period.start_time, period.end_time, assignment\?\.grade_level\)/);
  assert.match(ui,/max=\{schoolDayEnd\(assignment.grade_level\)\}/);
  assert.match(ui,/max=\{schoolDayEnd\(lookup.assignmentsById.get\(editAssignment\)\?\.grade_level\)\}/);
});

test("Database enforces grade-specific 4:30 or 4:45 after broad constraint, not only frontend",()=>{
  const sql=read("supabase/migrations/20261015133500_grade_aware_school_hours_shs_1645.sql");
  assert.match(sql,/add constraint class_schedules_school_hours_check/);
  assert.match(sql,/end_time <= time '16:45'/);
  assert.match(sql,/when grade in \(11,12\) then time '16:45' else time '16:30'/);
  assert.match(sql,/before insert or update of teacher_assignment_id, start_time, end_time/);
  assert.match(sql,/private.enforce_school_day_by_grade/);
});

test("Grade 12 editor accepts 4:45 PM without marking it an error",()=>{
  const endpoint=read("app/api/admin/grade12-term-program/route.ts");
  const inline=read("app/portal/admin/schedules/grade12-inline.tsx");
  assert.match(endpoint,/end > "16:45"/);
  assert.doesNotMatch(endpoint,/end>"16:30" \? "Ends after 4:30 PM"/);
  assert.match(inline,/max="16:45"/);
  const sql=read("supabase/migrations/20261015133500_grade_aware_school_hours_shs_1645.sql");
  assert.match(sql,/review_reason=r.remaining_reason,needs_review=\(r.remaining_reason is not null\)/);
});
