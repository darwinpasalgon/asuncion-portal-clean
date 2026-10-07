create or replace function private.teacher_can_read_enrollment(
  target_school_year_id uuid,
  target_section_id uuid
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
        or p.id = any(ta.co_teacher_ids)
      where p.id = (select auth.uid())
        and p.role = 'teacher'
        and p.account_status = 'active'
        and ta.school_year_id = target_school_year_id
        and ta.section_id = target_section_id
        and ta.is_active = true
    );
$function$;

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
        or p.id = any(ta.co_teacher_ids)
      where p.id = (select auth.uid())
        and p.role = 'teacher'
        and p.account_status = 'active'
        and ta.school_year_id = target_school_year_id
        and ta.section_id = target_section_id
        and ta.is_active = true
        and (ta.major is null or ta.major = target_tve_major)
    );
$function$;

create or replace function private.teacher_can_read_student_profile(p_student_id uuid)
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
      from public.profiles teacher
      join public.teacher_assignments ta
        on ta.teacher_id = teacher.id
        or teacher.id = any(ta.co_teacher_ids)
      join public.student_enrollments e
        on e.school_year_id = ta.school_year_id
       and e.section_id = ta.section_id
      where teacher.id = (select auth.uid())
        and teacher.role = 'teacher'
        and teacher.account_status = 'active'
        and ta.is_active = true
        and e.enrollment_status = 'active'
        and e.student_id = p_student_id
        and (ta.major is null or ta.major = e.tve_major)
    );
$function$;

with active_year as (
  select id
  from public.school_years
  where is_active = true
  limit 1
),
apitong as (
  select id
  from public.sections
  where grade_level = 8
    and name = 'Apitong'
    and is_active = true
  limit 1
)
update public.student_enrollments se
set tve_major = 'Agriculture Crop Production',
    updated_at = now()
where se.school_year_id = (select id from active_year)
  and se.section_id = (select id from apitong)
  and se.enrollment_status = 'active';

with active_year as (
  select id
  from public.school_years
  where is_active = true
  limit 1
),
apitong as (
  select id
  from public.sections
  where grade_level = 8
    and name = 'Apitong'
    and is_active = true
  limit 1
),
other_tve as (
  select ta.id
  from public.teacher_assignments ta
  join public.subjects sub on sub.id = ta.subject_id
  where ta.school_year_id = (select id from active_year)
    and ta.section_id = (select id from apitong)
    and ta.grade_level = 8
    and ta.is_active = true
    and sub.name = 'Technical Vocational Education'
    and coalesce(ta.major, '') <> 'Agriculture Crop Production'
)
update public.class_schedules cs
set is_active = false,
    updated_at = now()
where cs.teacher_assignment_id in (select id from other_tve)
  and cs.is_active = true;

with active_year as (
  select id
  from public.school_years
  where is_active = true
  limit 1
),
apitong as (
  select id
  from public.sections
  where grade_level = 8
    and name = 'Apitong'
    and is_active = true
  limit 1
)
update public.teacher_assignments ta
set is_active = false,
    updated_at = now()
from public.subjects sub
where ta.school_year_id = (select id from active_year)
  and ta.section_id = (select id from apitong)
  and ta.subject_id = sub.id
  and ta.grade_level = 8
  and ta.is_active = true
  and sub.name = 'Technical Vocational Education'
  and coalesce(ta.major, '') <> 'Agriculture Crop Production';
