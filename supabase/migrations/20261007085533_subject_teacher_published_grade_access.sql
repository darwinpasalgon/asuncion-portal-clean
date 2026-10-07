create or replace function private.teacher_can_read_published_grade(p_assignment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select auth.uid()) is not null
    and exists (
      select 1
      from public.profiles p
      join public.teacher_assignments ta
        on ta.id = p_assignment_id
      where p.id = (select auth.uid())
        and p.role = 'teacher'
        and p.account_status = 'active'
        and ta.is_active = true
        and (
          ta.teacher_id = p.id
          or p.id = any(coalesce(ta.co_teacher_ids, '{}'::uuid[]))
        )
    );
$$;

revoke all on function private.teacher_can_read_published_grade(uuid) from public;
grant execute on function private.teacher_can_read_published_grade(uuid) to authenticated;

drop policy if exists "Subject teachers read published grades" on public.student_term_grades;

drop policy if exists "Teachers read own grade records" on public.student_term_grades;
create policy "Teachers read own grade records"
on public.student_term_grades
for select
to authenticated
using (
  (select private.teacher_can_manage_grade(teacher_assignment_id))
  or (
    status = 'published'
    and (select private.teacher_can_read_published_grade(teacher_assignment_id))
  )
);
