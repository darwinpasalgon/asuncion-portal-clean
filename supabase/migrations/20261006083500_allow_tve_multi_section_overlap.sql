create or replace function private.validate_class_schedule()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  assignment_row public.teacher_assignments%rowtype;
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

  normalized_room := nullif(lower(trim(coalesce(new.room, ''))), '');

  if new.is_active and exists (
    select 1
    from public.class_schedules cs
    join public.teacher_assignments other_ta
      on other_ta.id = cs.teacher_assignment_id
    where cs.id is distinct from new.id
      and cs.is_active = true
      and other_ta.is_active = true
      and other_ta.school_year_id = assignment_row.school_year_id
      and cs.day_of_week = new.day_of_week
      and cs.start_time < new.end_time
      and cs.end_time > new.start_time
      and (
        (
          other_ta.teacher_id = assignment_row.teacher_id
          and not (
            other_ta.section_id <> assignment_row.section_id
            and other_ta.subject_id = assignment_row.subject_id
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
       where cs.id is distinct from new.id
         and cs.is_active = true
         and other_ta.is_active = true
         and other_ta.school_year_id = assignment_row.school_year_id
         and cs.day_of_week = new.day_of_week
         and cs.start_time < new.end_time
         and cs.end_time > new.start_time
         and nullif(lower(trim(coalesce(cs.room, ''))), '') = normalized_room
         and not (
           other_ta.teacher_id = assignment_row.teacher_id
           and other_ta.section_id <> assignment_row.section_id
           and other_ta.subject_id = assignment_row.subject_id
           and assignment_row.major is not null
           and other_ta.major = assignment_row.major
         )
     ) then
    raise exception 'schedule conflicts with an existing room schedule';
  end if;

  return new;
end;
$function$;
