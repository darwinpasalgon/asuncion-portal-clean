-- Validate new/changed periods across the two timetable models and TVE rotations.
-- Existing source overlaps remain untouched until their scheduling fields change.
-- Trigger functions are private, not callable through the Data API; table RLS
-- continues to authorize every write. The school-year lock serializes editors.
create or replace function private.validate_cross_source_schedule()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  yr uuid;
  sec uuid;
  staff uuid[];
  days smallint[];
  slot_start time;
  slot_end time;
  assignment public.teacher_assignments%rowtype;
  term smallint;
  subject text;
begin
  if tg_table_name = 'grade12_term_periods' then
    if tg_op = 'UPDATE' and
      row(new.school_year_id,new.section_id,new.term_no,new.day_of_week,new.start_time,new.end_time,new.instructor_ids,new.subject_label)
      is not distinct from
      row(old.school_year_id,old.section_id,old.term_no,old.day_of_week,old.start_time,old.end_time,old.instructor_ids,old.subject_label)
    then return new; end if;
    yr:=new.school_year_id; sec:=new.section_id; staff:=new.instructor_ids;
    days:=array[new.day_of_week]; slot_start:=new.start_time; slot_end:=new.end_time;
    term:=new.term_no; subject:=new.subject_label;
  elsif tg_table_name = 'class_schedules' then
    if not new.is_active then return new; end if;
    if tg_op = 'UPDATE' and
      row(new.teacher_assignment_id,new.day_of_week,new.start_time,new.end_time,new.is_active)
      is not distinct from
      row(old.teacher_assignment_id,old.day_of_week,old.start_time,old.end_time,old.is_active)
    then return new; end if;
    select * into assignment from public.teacher_assignments where id=new.teacher_assignment_id;
    -- Grade 12 term periods are authoritative; do not create new legacy rows.
    if assignment.grade_level=12 then
      raise exception 'Grade 12 schedules must be edited in the term class program';
    end if;
    yr:=assignment.school_year_id; sec:=assignment.section_id;
    staff:=array[assignment.teacher_id] || coalesce(assignment.co_teacher_ids,'{}'::uuid[]);
    days:=array[new.day_of_week]; slot_start:=new.start_time; slot_end:=new.end_time;
  else
    if not new.is_active then return new; end if;
    if tg_op = 'UPDATE' and
      row(new.school_year_id,new.section_id,new.teacher_id,new.days_of_week,new.start_time,new.end_time,new.starts_on,new.ends_on,new.is_active)
      is not distinct from
      row(old.school_year_id,old.section_id,old.teacher_id,old.days_of_week,old.start_time,old.end_time,old.starts_on,old.ends_on,old.is_active)
    then return new; end if;
    yr:=new.school_year_id; sec:=new.section_id; staff:=array[new.teacher_id];
    days:=new.days_of_week; slot_start:=new.start_time; slot_end:=new.end_time;
  end if;
  perform pg_advisory_xact_lock(hashtextextended(yr::text,0));

  if exists (
    select 1 from public.grade12_term_periods p
    where p.school_year_id=yr and p.day_of_week=any(days)
      and p.start_time<slot_end and slot_start<p.end_time
      and (term is null or p.term_no=term)
      and (tg_table_name<>'grade12_term_periods' or p.id<>new.id)
      and (
        (p.instructor_ids && staff and not (
          tg_table_name='grade12_term_periods' and p.section_id<>sec
          and subject='ORGANIC AGRICULTURE PRODUCTION/FOOD PROCESSING'
          and p.subject_label='ORGANIC AGRICULTURE PRODUCTION/FOOD PROCESSING'))
        or (p.section_id=sec and not (
          tg_table_name='grade12_term_periods' and subject<>p.subject_label
          and subject in ('ORGANIC AGRICULTURE PRODUCTION','FOOD PROCESSING')
          and p.subject_label in ('ORGANIC AGRICULTURE PRODUCTION','FOOD PROCESSING')))
      )
  ) then raise exception 'schedule conflicts with an existing Grade 12 term teacher or section period'; end if;

  if tg_table_name='grade12_term_periods' then
    if exists (
      select 1 from public.class_schedules cs
      join public.teacher_assignments ta on ta.id=cs.teacher_assignment_id
      where cs.is_active and ta.is_active and ta.grade_level<>12
        and ta.school_year_id=yr and cs.day_of_week=any(days)
        and cs.start_time<slot_end and slot_start<cs.end_time
        and (ta.section_id=sec or (array[ta.teacher_id] || coalesce(ta.co_teacher_ids,'{}'::uuid[])) && staff)
    ) then raise exception 'schedule conflicts with an existing Junior High or Grade 11 teacher period'; end if;
    if exists (
      select 1 from public.grade7_tve_rotations r
      where r.is_active and r.school_year_id=yr and r.days_of_week && days
        and r.start_time<slot_end and slot_start<r.end_time
        and (r.section_id=sec or r.teacher_id=any(staff))
    ) then raise exception 'schedule conflicts with an active Grade 7 TVE rotation; review its date range'; end if;
    if exists (
      select 1 from public.schedule_blocks b
      where b.is_active and b.school_year_id=yr and b.section_id=sec
        and b.day_of_week=any(days) and b.start_time<slot_end and slot_start<b.end_time
    ) then raise exception 'schedule conflicts with a reserved section period'; end if;
  end if;
  return new;
end;
$$;
revoke all on function private.validate_cross_source_schedule() from public,anon,authenticated;
create trigger grade12_cross_source_schedule_guard
before insert or update on public.grade12_term_periods
for each row execute function private.validate_cross_source_schedule();
create trigger regular_cross_source_schedule_guard
before insert or update on public.class_schedules
for each row execute function private.validate_cross_source_schedule();
create trigger rotation_cross_source_schedule_guard
before insert or update on public.grade7_tve_rotations
for each row execute function private.validate_cross_source_schedule();
