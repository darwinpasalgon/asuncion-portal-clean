drop policy if exists "Advisers read historical school form learner information" on public.learner_information;

create policy "Advisers read historical school form learner information"
on public.learner_information
for select
to authenticated
using (
  exists (
    select 1
    from public.student_enrollments se
    join public.section_advisers sa
      on sa.school_year_id = se.school_year_id
     and sa.section_id = se.section_id
     and sa.teacher_id = (select auth.uid())
     and sa.is_active = true
    where se.student_id = learner_information.student_id
  )
);