alter table public.teacher_assignments
  add column if not exists co_teacher_ids uuid[] not null default '{}'::uuid[];

alter table public.teacher_assignments
  drop constraint if exists teacher_assignments_primary_not_coteacher;

alter table public.teacher_assignments
  add constraint teacher_assignments_primary_not_coteacher
  check (array_position(co_teacher_ids, teacher_id) is null);

create index if not exists teacher_assignments_co_teacher_ids_gin
  on public.teacher_assignments using gin (co_teacher_ids);

drop policy if exists "Teachers read own assignments" on public.teacher_assignments;
create policy "Teachers read own assignments"
on public.teacher_assignments
for select
to authenticated
using (
  teacher_id = (select auth.uid())
  or (select auth.uid()) = any(co_teacher_ids)
  or (select private.teacher_is_section_adviser(teacher_assignments.school_year_id, teacher_assignments.section_id))
  or (select private.is_active_admin())
);

drop policy if exists "Teachers read own class schedules" on public.class_schedules;
create policy "Teachers read own class schedules"
on public.class_schedules
for select
to authenticated
using (
  exists (
    select 1
    from public.teacher_assignments ta
    where ta.id = class_schedules.teacher_assignment_id
      and ta.is_active = true
      and (
        ta.teacher_id = (select auth.uid())
        or (select auth.uid()) = any(ta.co_teacher_ids)
      )
  )
);

create or replace function private.validate_class_schedule()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  assignment_row public.teacher_assignments%rowtype;
  assignment_subject_name text;
  normalized_room text;
begin
  if new.start_time >= new.end_time then
    raise exception 'schedule end time must be later than start time';
  end if;

  select * into assignment_row
  from public.teacher_assignments
  where id = new.teacher_assignment_id;

  if assignment_row.id is null or assignment_row.is_active is not true then
    raise exception 'teacher assignment must be active';
  end if;

  select name into assignment_subject_name
  from public.subjects
  where id = assignment_row.subject_id;

  normalized_room := nullif(lower(trim(coalesce(new.room, ''))), '');

  if new.is_active and exists (
    select 1
    from public.class_schedules cs
    join public.teacher_assignments other_ta
      on other_ta.id = cs.teacher_assignment_id
    join public.subjects other_subject
      on other_subject.id = other_ta.subject_id
    where cs.id is distinct from new.id
      and cs.is_active = true
      and other_ta.is_active = true
      and other_ta.school_year_id = assignment_row.school_year_id
      and cs.day_of_week = new.day_of_week
      and cs.start_time < new.end_time
      and cs.end_time > new.start_time
      and (
        (
          (
            array[other_ta.teacher_id] || coalesce(other_ta.co_teacher_ids, '{}'::uuid[])
          ) && (
            array[assignment_row.teacher_id] || coalesce(assignment_row.co_teacher_ids, '{}'::uuid[])
          )
          and not (
            other_ta.section_id <> assignment_row.section_id
            and assignment_subject_name = 'Technical Vocational Education'
            and other_subject.name = 'Technical Vocational Education'
            and assignment_row.major is not null
            and other_ta.major = assignment_row.major
          )
        )
        or (
          other_ta.section_id = assignment_row.section_id
          and not (
            assignment_row.major is not null
            and other_ta.major is not null
            and assignment_row.subject_id = other_ta.subject_id
            and assignment_row.major <> other_ta.major
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
         on other_ta.id = cs.teacher_assignment_id
       join public.subjects other_subject
         on other_subject.id = other_ta.subject_id
       where cs.id is distinct from new.id
         and cs.is_active = true
         and other_ta.is_active = true
         and other_ta.school_year_id = assignment_row.school_year_id
         and cs.day_of_week = new.day_of_week
         and cs.start_time < new.end_time
         and cs.end_time > new.start_time
         and nullif(lower(trim(coalesce(cs.room, ''))), '') = normalized_room
         and not (
           (
             array[other_ta.teacher_id] || coalesce(other_ta.co_teacher_ids, '{}'::uuid[])
           ) && (
             array[assignment_row.teacher_id] || coalesce(assignment_row.co_teacher_ids, '{}'::uuid[])
           )
           and other_ta.section_id <> assignment_row.section_id
           and assignment_subject_name = 'Technical Vocational Education'
           and other_subject.name = 'Technical Vocational Education'
           and assignment_row.major is not null
           and other_ta.major = assignment_row.major
         )
     ) then
    raise exception 'schedule conflicts with an existing room schedule';
  end if;

  return new;
end;
$function$;

update public.teacher_assignments ta
set co_teacher_ids = array[p.id],
    updated_at = now()
from public.profiles p,
     public.sections s,
     public.subjects sub,
     public.school_years sy
where p.full_name = 'GEMMA M. GIELO'
  and p.role = 'teacher'
  and p.account_status = 'active'
  and s.name = 'Apitong'
  and s.grade_level = 8
  and s.is_active = true
  and sub.name = 'Technical Vocational Education'
  and sub.grade_level = 8
  and sub.is_active = true
  and sy.is_active = true
  and ta.school_year_id = sy.id
  and ta.section_id = s.id
  and ta.subject_id = sub.id
  and ta.major = 'Agriculture Crop Production'
  and ta.is_active = true;
