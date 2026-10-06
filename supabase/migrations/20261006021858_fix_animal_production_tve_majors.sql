begin;

alter table public.teacher_assignments
  drop constraint if exists teacher_assignments_major_check;

alter table public.teacher_assignments
  add constraint teacher_assignments_major_check
  check (
    major is null or major in (
      'Computer Systems Servicing',
      'Electrical Installation and Maintenance',
      'Food Processing',
      'Animal Production - Poultry',
      'Animal Production - Swine',
      'Agriculture Crop Production'
    )
  );

alter table public.student_enrollments
  drop constraint if exists student_enrollments_tve_major_check;

alter table public.student_enrollments
  add constraint student_enrollments_tve_major_check
  check (
    tve_major is null or (
      grade_level in (8,9,10)
      and tve_major in (
        'Computer Systems Servicing',
        'Electrical Installation and Maintenance',
        'Food Processing',
        'Animal Production - Poultry',
        'Animal Production - Swine',
        'Agriculture Crop Production'
      )
    )
  );

create or replace function public.set_adviser_student_tve_major(
  p_enrollment_id uuid,
  p_major text
)
returns table (
  id uuid,
  student_id uuid,
  grade_level smallint,
  section_id uuid,
  tve_major text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  enrollment_row public.student_enrollments%rowtype;
  normalized_major text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select *
  into enrollment_row
  from public.student_enrollments
  where student_enrollments.id = p_enrollment_id;

  if enrollment_row.id is null then
    raise exception 'Learner enrollment not found';
  end if;

  if enrollment_row.grade_level not in (8,9,10) then
    raise exception 'TVE Major applies only to Grades 8, 9, and 10';
  end if;

  if enrollment_row.section_id is null then
    raise exception 'Learner is not assigned to a section';
  end if;

  if not exists (
    select 1
    from public.profiles p
    join public.section_advisers sa
      on sa.teacher_id = p.id
     and sa.school_year_id = enrollment_row.school_year_id
     and sa.section_id = enrollment_row.section_id
     and sa.is_active = true
    where p.id = auth.uid()
      and p.role = 'teacher'
      and p.account_status = 'active'
  ) then
    raise exception 'Only the active Section Adviser can update the learner TVE Major';
  end if;

  normalized_major := nullif(trim(coalesce(p_major, '')), '');

  if normalized_major is not null and normalized_major not in (
    'Computer Systems Servicing',
    'Electrical Installation and Maintenance',
    'Food Processing',
    'Animal Production - Poultry',
    'Animal Production - Swine',
    'Agriculture Crop Production'
  ) then
    raise exception 'Select a valid TVE Major';
  end if;

  return query
  update public.student_enrollments se
  set tve_major = normalized_major,
      updated_at = now()
  where se.id = p_enrollment_id
  returning se.id, se.student_id, se.grade_level, se.section_id, se.tve_major;
end;
$$;

revoke all on function public.set_adviser_student_tve_major(uuid,text) from public;
grant execute on function public.set_adviser_student_tve_major(uuid,text) to authenticated;

commit;
