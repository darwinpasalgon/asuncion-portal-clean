const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");

test("Grade 12 adviser Grades lists only graded subjects assigned in current term",()=>{
 const api=read("app/api/academic/grades/route.ts");
 const page=read("app/portal/grades/page.tsx");
 assert.match(api,/grade12_term_gradebook\?school_year_id=eq/);
 assert.match(api,/grade12TermGradebook,/);
 assert.match(api,/subjectAssignments/);
 assert.match(page,/termScopedAssignments/);
 assert.match(page,/link.term_no === selectedTerm/);
 assert.match(page,/link.teacher_assignment_id === assignment.id/);
 assert.match(page,/gradebookAssignments\.map/);
 assert.match(page,/setSelectedAssignmentId\(gradebookAssignments\[0\]\?\.id \?\? ""\)/);
 assert.match(page,/subjectTermAssignments/);
 assert.match(page,/link.term_teacher_id === profile\?\.id/);
});

test("Grade 12 term table preserves subject-teacher assignment and only lets advisers grade scheduled term",()=>{
 const sql=read("supabase/migrations/20261015185500_grade12_term_gradebook_and_unified_aral.sql");
 const api=read("app/api/academic/grades/route.ts");
 assert.match(sql,/create table if not exists public.grade12_term_gradebook/);
 assert.match(sql,/unique\(school_year_id,section_id,subject_id,term_no\)/);
 assert.match(sql,/term_teacher_id uuid references public.profiles/);
 assert.match(read("supabase/migrations/20261015192000_flag_grade12_mixed_tvl_grading.sql"),/requires_learner_group/);
 assert.match(sql,/security_invoker=true/);
 assert.match(api,/validateGrade12GradingTerm\(/);
 assert.match(api,/This Grade 12 subject is not scheduled for the selected term/);
 assert.match(api,/The Grade 12 subject teacher has not yet been linked/);
 assert.match(api,/requires_learner_group/);
});

test("ARAL Reading, Math, Program consolidated to ARAL and never graded or on school forms",()=>{
 const migration=read("supabase/migrations/20261015185500_grade12_term_gradebook_and_unified_aral.sql");
 const teaching=read("app/api/admin/teaching-setup/route.ts");
 const grades=read("app/api/academic/grades/route.ts");
 const sf9=read("app/api/academic/sf9/route.ts");
 assert.match(migration,/update public.subjects/);
 assert.match(migration,/is_graded=false,include_in_school_forms=false/);
 assert.match(migration,/when upper\(subject_label\) like 'ARAL %' then 'ARAL'/);
 assert.match(migration,/HGP\/ARAL/);
 assert.match(teaching,/canonicalShsAralName/);
 assert.match(teaching,/\^ARAL\(\?:\\s\|\$\)/);
 assert.match(grades,/item.is_graded !== false/);
 assert.match(grades,/does not accept grades/);
 assert.match(sf9,/subject.is_graded !== false &&/);
});

test("Combined Food Processing and Organic Agriculture periods are visible but guarded until each learner's program is known",()=>{
 const migration=read("supabase/migrations/20261015192000_flag_grade12_mixed_tvl_grading.sql");
 const page=read("app/portal/grades/page.tsx");
 assert.match(migration,/requires_learner_group/);
 assert.match(page,/selectedMixedTvlGradebook/);
 assert.match(page,/Their individual Grade 12 SHS specialization/);
 assert.match(page,/disabled=\{Boolean\(working\) \|\| classStudents.length === 0 \|\| selectedMixedTvlGradebook\}/);
});
