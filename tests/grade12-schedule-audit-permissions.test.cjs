const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");

test("Grade 12 audit flags both sides of real cross-section instructor overlaps without shifting periods",()=>{
 const audit=read("supabase/migrations/20261015195500_flag_confirmed_grade12_cross_section_teacher_conflicts.sql");
 assert.match(audit,/p\.instructor_ids&&q\.instructor_ids/);
 assert.match(audit,/p\.start_time<q\.end_time and q\.start_time<p\.end_time/);
 assert.match(audit,/not \(/);
 assert.match(audit,/ORGANIC AGRICULTURE PRODUCTION\/FOOD PROCESSING/);
 assert.match(audit,/needs_review=true/);
 assert.match(audit,/review_reason=case/);
 assert.doesNotMatch(audit,/set.*start_time\s*=/);
 assert.doesNotMatch(audit,/delete from/);
});

test("Different Grade 12 term instructors receive read-only access to their own classes",()=>{
 const access=read("supabase/migrations/20261015201200_grade12_term_teacher_read_only_access.sql");
 assert.match(access,/private\.shs_term_teacher_can_read_assignment/);
 assert.match(access,/private\.shs_term_teacher_can_read_section/);
 assert.match(access,/private\.shs_term_teacher_can_read_student/);
 assert.match(access,/private\.shs_term_teacher_can_read_published_grade/);
 assert.match(access,/security definer set search_path = ''/);
 assert.match(access,/grant execute on function private\.shs_term_teacher_can_read_assignment\(uuid\) to authenticated/);
 assert.match(access,/for select to authenticated/g);
 assert.match(access,/grade_level=12/);
 assert.match(access,/status='published'/);
 assert.match(access,/gb\.term_no = p_term_no/);
 assert.match(access,/not gb\.requires_learner_group/);
 assert.doesNotMatch(access,/for (insert|update|delete|all) to authenticated/i);
});

test("Term teacher visibility uses the logged-in identity and active teaching personnel, not user metadata",()=>{
 const access=read("supabase/migrations/20261015201200_grade12_term_teacher_read_only_access.sql");
 assert.match(access,/gb\.term_teacher_id = \(select auth\.uid\(\)\)/);
 assert.match(access,/pr\.role = 'teacher' and pr\.account_status = 'active'/);
 assert.doesNotMatch(access,/user_metadata|app_metadata|raw_user_meta_data/i);
});

test("Grade 12 adviser Grades continues using term mapping and excludes non-graded ARAL",()=>{
 const api=read("app/api/academic/grades/route.ts");
 const page=read("app/portal/grades/page.tsx");
 assert.match(api,/grade12_term_gradebook\?school_year_id=eq/);
 assert.match(api,/validateGrade12GradingTerm/);
 assert.match(api,/item\.is_graded !== false/);
 assert.match(page,/termScopedAssignments/);
 assert.match(page,/grade12TermGradebook/);
 assert.match(page,/requires_learner_group/);
});
