-- Term 2 Grade 12 instructors can differ from the canonical year-wide
-- teacher_assignment.teacher_id. Grant the *actual* term teacher read-only
-- access to their assignment, current enrolled learners, and published grades.
-- Do not grant grading/publishing/editing rights.
-- Security-definer checks live in the private (non-Data-API) schema and use
-- the authenticated identity, not user-controlled metadata or a caller UID.

create or replace function private.shs_term_teacher_can_read_assignment(p_assignment_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null and exists (
    select 1 from public.grade12_term_gradebook gb
    join public.profiles pr on pr.id = (select auth.uid())
      and pr.role = 'teacher' and pr.account_status = 'active'
    where gb.teacher_assignment_id = p_assignment_id
      and gb.term_teacher_id = (select auth.uid())
  );
$$;

create or replace function private.shs_term_teacher_can_read_section(p_school_year_id uuid,p_section_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null and exists (
    select 1 from public.grade12_term_gradebook gb
    join public.profiles pr on pr.id = (select auth.uid())
      and pr.role = 'teacher' and pr.account_status = 'active'
    where gb.school_year_id = p_school_year_id
      and gb.section_id = p_section_id
      and gb.term_teacher_id = (select auth.uid())
      and not gb.requires_learner_group
  );
$$;

create or replace function private.shs_term_teacher_can_read_student(p_student_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null and exists (
    select 1 from public.grade12_term_gradebook gb
    join public.profiles pr on pr.id = (select auth.uid())
      and pr.role = 'teacher' and pr.account_status = 'active'
    join public.student_enrollments se
      on se.school_year_id = gb.school_year_id
      and se.section_id = gb.section_id
      and se.enrollment_status = 'active'
      and se.student_id = p_student_id
    where gb.term_teacher_id = (select auth.uid())
      and not gb.requires_learner_group
  );
$$;

create or replace function private.shs_term_teacher_can_read_published_grade(p_assignment_id uuid,p_term_no smallint)
returns boolean language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null and exists (
    select 1 from public.grade12_term_gradebook gb
    join public.profiles pr on pr.id = (select auth.uid())
      and pr.role = 'teacher' and pr.account_status = 'active'
    where gb.teacher_assignment_id = p_assignment_id
      and gb.term_no = p_term_no
      and gb.term_teacher_id = (select auth.uid())
      and not gb.requires_learner_group
  );
$$;

revoke all on function private.shs_term_teacher_can_read_assignment(uuid) from public,anon,authenticated;
revoke all on function private.shs_term_teacher_can_read_section(uuid,uuid) from public,anon,authenticated;
revoke all on function private.shs_term_teacher_can_read_student(uuid) from public,anon,authenticated;
revoke all on function private.shs_term_teacher_can_read_published_grade(uuid,smallint) from public,anon,authenticated;
grant execute on function private.shs_term_teacher_can_read_assignment(uuid) to authenticated;
grant execute on function private.shs_term_teacher_can_read_section(uuid,uuid) to authenticated;
grant execute on function private.shs_term_teacher_can_read_student(uuid) to authenticated;
grant execute on function private.shs_term_teacher_can_read_published_grade(uuid,smallint) to authenticated;

drop policy if exists "Grade12 term instructors read own assignments" on public.teacher_assignments;
create policy "Grade12 term instructors read own assignments" on public.teacher_assignments
for select to authenticated
using (grade_level=12 and (select private.shs_term_teacher_can_read_assignment(id)));

drop policy if exists "Grade12 term instructors read assigned enrollments" on public.student_enrollments;
create policy "Grade12 term instructors read assigned enrollments" on public.student_enrollments
for select to authenticated
using (grade_level=12 and (select private.shs_term_teacher_can_read_section(school_year_id,section_id)));

drop policy if exists "Grade12 term instructors read assigned learner profiles" on public.profiles;
create policy "Grade12 term instructors read assigned learner profiles" on public.profiles
for select to authenticated
using (role='student' and (select private.shs_term_teacher_can_read_student(id)));

drop policy if exists "Grade12 term instructors read own published term grades" on public.student_term_grades;
create policy "Grade12 term instructors read own published term grades" on public.student_term_grades
for select to authenticated
using (status='published' and (select private.shs_term_teacher_can_read_published_grade(teacher_assignment_id,term_no)));
