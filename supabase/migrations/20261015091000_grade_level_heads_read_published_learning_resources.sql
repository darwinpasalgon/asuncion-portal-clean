-- Grade Level Heads may monitor published modules within their assigned grade.
-- They cannot edit materials posted by subject teachers and cannot browse other grades.
create policy "Grade Level Heads read published resources in their grade"
on public.learning_resources for select to authenticated
using (
  resource_scope = 'class'
  and status = 'published'
  and exists (
    select 1
    from public.teacher_assignments ta
    join public.grade_level_heads ghl on ghl.grade_level = ta.grade_level
    where ta.id = learning_resources.teacher_assignment_id
      and ta.school_year_id = learning_resources.school_year_id
      and ta.is_active = true
      and ghl.is_active = true
      and ghl.profile_id = (select auth.uid())
  )
);
