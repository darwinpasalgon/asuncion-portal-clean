-- Active SHS advisers may read term subject offerings of their own grade
-- to populate SF9. This does not permit writing or access to another grade.
drop policy if exists "Active SHS advisers read term subject offerings"
  on public.shs_subject_offerings;
create policy "Active SHS advisers read term subject offerings"
on public.shs_subject_offerings for select to authenticated
using (
  exists (
    select 1 from public.section_advisers sa
    join public.sections s on s.id=sa.section_id
    join public.profiles adviser on adviser.id=sa.teacher_id
    where sa.teacher_id=(select auth.uid())
      and sa.is_active=true
      and sa.school_year_id=shs_subject_offerings.school_year_id
      and s.grade_level=shs_subject_offerings.grade_level
      and adviser.role='teacher'
      and adviser.account_status='active'
  )
);
