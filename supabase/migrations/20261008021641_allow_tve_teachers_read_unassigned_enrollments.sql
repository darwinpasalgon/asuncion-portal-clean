create or replace function private.teacher_can_read_enrollment(
  target_school_year_id uuid,
  target_section_id uuid,
  target_tve_major text
)
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
      join public.teacher_assignments ta
        on ta.teacher_id = p.id
        or p.id = any(coalesce(ta.co_teacher_ids, '{}'::uuid[]))
      where p.id = (select auth.uid())
        and p.role = 'teacher'
        and p.account_status = 'active'
        and ta.school_year_id = target_school_year_id
        and ta.section_id = target_section_id
        and ta.is_active = true
        and (
          ta.major is null
          or target_tve_major is null
          or ta.major = target_tve_major
        )
    );
$function$;
