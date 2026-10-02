begin;

alter table public.student_enrollments
  add column if not exists tve_major text;

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
        'Animal Production',
        'Agriculture Crop Production'
      )
    )
  );

alter table public.teacher_assignments
  drop constraint if exists teacher_assignments_school_year_id_section_id_subject_id_key;

create unique index if not exists teacher_assignments_section_subject_no_major_uniq
  on public.teacher_assignments (school_year_id, section_id, subject_id)
  where major is null;

create unique index if not exists teacher_assignments_section_subject_major_uniq
  on public.teacher_assignments (school_year_id, section_id, subject_id, major)
  where major is not null;

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
    'Animal Production',
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

create or replace function private.validate_class_schedule()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  assignment_row public.teacher_assignments%rowtype;
  normalized_room text;
begin
  if new.start_time >= new.end_time then
    raise exception 'schedule end time must be later than start time';
  end if;

  select * into assignment_row
  from public.teacher_assignments
  where id=new.teacher_assignment_id;

  if assignment_row.id is null or assignment_row.is_active is not true then
    raise exception 'teacher assignment must be active';
  end if;

  normalized_room := nullif(lower(trim(coalesce(new.room,''))), '');

  if new.is_active and exists (
    select 1
    from public.class_schedules cs
    join public.teacher_assignments other_ta
      on other_ta.id=cs.teacher_assignment_id
    where cs.id is distinct from new.id
      and cs.is_active=true
      and other_ta.is_active=true
      and other_ta.school_year_id=assignment_row.school_year_id
      and cs.day_of_week=new.day_of_week
      and cs.start_time < new.end_time
      and cs.end_time > new.start_time
      and (
        other_ta.teacher_id=assignment_row.teacher_id
        or (
          other_ta.section_id=assignment_row.section_id
          and not (
            assignment_row.major is not null
            and other_ta.major is not null
            and assignment_row.subject_id=other_ta.subject_id
            and assignment_row.major<>other_ta.major
          )
        )
      )
  ) then
    raise exception 'schedule conflicts with an existing teacher or section schedule';
  end if;

  if new.is_active
     and normalized_room is not null
     and exists (
       select 1
       from public.class_schedules cs
       join public.teacher_assignments other_ta
         on other_ta.id=cs.teacher_assignment_id
       where cs.id is distinct from new.id
         and cs.is_active=true
         and other_ta.is_active=true
         and other_ta.school_year_id=assignment_row.school_year_id
         and cs.day_of_week=new.day_of_week
         and cs.start_time < new.end_time
         and cs.end_time > new.start_time
         and nullif(lower(trim(coalesce(cs.room,''))), '')=normalized_room
     ) then
    raise exception 'schedule conflicts with an existing room schedule';
  end if;

  return new;
end;
$$;


create or replace function private.teacher_can_read_enrollment(
  target_school_year_id uuid,
  target_section_id uuid,
  target_tve_major text
)
returns boolean
language sql
stable
security definer
set search_path to ''
as $
  select
    (select auth.uid()) is not null
    and exists (
      select 1
      from public.profiles p
      join public.teacher_assignments ta on ta.teacher_id=p.id
      where p.id=(select auth.uid())
        and p.role='teacher'
        and p.account_status='active'
        and ta.school_year_id=target_school_year_id
        and ta.section_id=target_section_id
        and ta.is_active=true
        and (ta.major is null or ta.major=target_tve_major)
    );
$;

drop policy if exists "Teachers read assigned student enrollments"
on public.student_enrollments;

create policy "Teachers read assigned student enrollments"
on public.student_enrollments
for select
to authenticated
using (
  private.teacher_can_read_enrollment(
    student_enrollments.school_year_id,
    student_enrollments.section_id,
    student_enrollments.tve_major
  )
);

create or replace function private.teacher_can_read_student_profile(p_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $
  select
    (select auth.uid()) is not null
    and exists (
      select 1
      from public.profiles teacher
      join public.teacher_assignments ta on ta.teacher_id=teacher.id
      join public.student_enrollments e
        on e.school_year_id=ta.school_year_id
       and e.section_id=ta.section_id
      where teacher.id=(select auth.uid())
        and teacher.role='teacher'
        and teacher.account_status='active'
        and ta.is_active=true
        and e.enrollment_status='active'
        and e.student_id=p_student_id
        and (ta.major is null or ta.major=e.tve_major)
    );
$;

create or replace function private.student_can_read_assignment(target_assignment_id uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $
  select
    (select auth.uid()) is not null
    and exists (
      select 1
      from public.profiles p
      join public.student_enrollments e on e.student_id=p.id
      join public.teacher_assignments ta
        on ta.school_year_id=e.school_year_id
       and ta.section_id=e.section_id
      where p.id=(select auth.uid())
        and p.role='student'
        and p.account_status='active'
        and e.enrollment_status='active'
        and ta.id=target_assignment_id
        and ta.is_active=true
        and (ta.major is null or ta.major=e.tve_major)
    );
$;


drop policy if exists "Students read own section schedules"
on public.class_schedules;

create policy "Students read own section schedules"
on public.class_schedules
for select
to authenticated
using (
  exists (
    select 1
    from public.teacher_assignments ta
    join public.student_enrollments e
      on e.school_year_id=ta.school_year_id
     and e.section_id=ta.section_id
    where ta.id=class_schedules.teacher_assignment_id
      and e.student_id=(select auth.uid())
      and e.enrollment_status='active'
      and ta.is_active=true
      and (ta.major is null or ta.major=e.tve_major)
  )
);

commit;
