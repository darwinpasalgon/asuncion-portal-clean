alter table public.class_schedules
  drop constraint if exists class_schedules_school_hours_check;

alter table public.class_schedules
  add constraint class_schedules_school_hours_check
  check (
    start_time >= time '07:30'
    and end_time <= time '16:30'
    and start_time < end_time
  );
