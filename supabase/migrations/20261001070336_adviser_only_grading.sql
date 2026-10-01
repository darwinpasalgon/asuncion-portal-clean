-- Enforce one active Section Adviser per section and make the Adviser the sole
-- teacher allowed to manage grades for every subject assignment in that section.

create unique index if not exists section_advisers_one_active_per_section_idx
  on public.section_advisers (school_year_id, section_id)
  where is_active = true;

create or replace function private.teacher_can_manage_grade(p_assignment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select
    (select auth.uid()) is not null
    and exists (
      select 1
      from public.profiles p
      join public.section_advisers sa
        on sa.teacher_id = p.id
       and sa.is_active = true
      join public.teacher_assignments ta
        on ta.id = p_assignment_id
       and ta.school_year_id = sa.school_year_id
       and ta.section_id = sa.section_id
      where p.id = (select auth.uid())
        and p.role = 'teacher'
        and p.account_status = 'active'
        and ta.is_active = true
    );
$function$;

drop policy if exists "Teachers read own assignments" on public.teacher_assignments;
create policy "Teachers read own assignments"
on public.teacher_assignments
as permissive
for select
to authenticated
using (
  teacher_id = (select auth.uid())
  or (select private.teacher_is_section_adviser(teacher_assignments.school_year_id, teacher_assignments.section_id))
  or (select private.is_active_admin())
);
