-- School time limits: JHS Grade 7–10 07:30–16:30, SHS Grade 11–12 07:30–16:45.
alter table public.class_schedules
  drop constraint if exists class_schedules_school_hours_check;
alter table public.class_schedules
  add constraint class_schedules_school_hours_check
  check (
    start_time >= time '07:30'
    and end_time <= time '16:45'
    and start_time < end_time
  );

create or replace function private.enforce_school_day_by_grade()
returns trigger language plpgsql set search_path = ''
as $$
declare
  grade smallint;
  cutoff time;
begin
  select ta.grade_level into grade
  from public.teacher_assignments ta
  where ta.id = new.teacher_assignment_id;
  if grade is null then
    raise exception 'Teacher assignment must exist to check school hours';
  end if;
  cutoff := case when grade in (11,12) then time '16:45' else time '16:30' end;
  if new.start_time < time '07:30'
     or new.end_time > cutoff or new.start_time >= new.end_time then
    raise exception 'Grade % class periods must be between 07:30 and %', grade, cutoff;
  end if;
  return new;
end;
$$;
drop trigger if exists enforce_school_day_by_grade on public.class_schedules;
create trigger enforce_school_day_by_grade
before insert or update of teacher_assignment_id, start_time, end_time
on public.class_schedules for each row
execute function private.enforce_school_day_by_grade();

-- A 4:45 dismissal is valid in Grade 12: only remove the obsolete 4:30 warning.
-- Keep independent flags for teacher conflicts, incomplete teacher details, or Excel labels.
with revised as (
 select p.id,
   nullif(string_agg(trim(x.note),'; ' order by x.ord)
    filter (where trim(x.note) not in (
       'Excel period ends after standard 4:30 PM portal cutoff',
       'Ends after 4:30 PM'
    ) and trim(x.note)<>''),'') as remaining_reason
 from public.grade12_term_periods p
 cross join lateral unnest(string_to_array(coalesce(p.review_reason,''),'; ')) with ordinality as x(note,ord)
 where p.review_reason ilike '%4:30%'
 group by p.id
)
update public.grade12_term_periods p
set review_reason=r.remaining_reason,needs_review=(r.remaining_reason is not null)
from revised r where p.id=r.id;
