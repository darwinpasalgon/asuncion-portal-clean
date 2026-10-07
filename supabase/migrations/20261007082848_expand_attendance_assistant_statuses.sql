alter table public.attendance_assistant_entries
  drop constraint if exists attendance_assistant_entries_status_check;

alter table public.attendance_assistant_entries
  add constraint attendance_assistant_entries_status_check
  check (status in ('present','absent','absent_morning','cutting_classes'));

drop policy if exists "Attendance assistants insert section entries" on public.attendance_assistant_entries;
create policy "Attendance assistants insert section entries"
on public.attendance_assistant_entries
for insert to authenticated
with check (
  (select private.is_attendance_assistant_for_section(school_year_id, section_id))
  and attendance_date=(now() at time zone 'Asia/Manila')::date
  and entered_by=(select auth.uid())
  and status in ('present','absent','absent_morning','cutting_classes')
  and exists (
    select 1
    from public.attendance_section_roster ar
    where ar.school_year_id=attendance_assistant_entries.school_year_id
      and ar.section_id=attendance_assistant_entries.section_id
      and ar.student_id=attendance_assistant_entries.student_id
  )
);

drop policy if exists "Attendance assistants update section entries" on public.attendance_assistant_entries;
create policy "Attendance assistants update section entries"
on public.attendance_assistant_entries
for update to authenticated
using (
  (select private.is_attendance_assistant_for_section(school_year_id, section_id))
  and attendance_date=(now() at time zone 'Asia/Manila')::date
)
with check (
  (select private.is_attendance_assistant_for_section(school_year_id, section_id))
  and attendance_date=(now() at time zone 'Asia/Manila')::date
  and entered_by=(select auth.uid())
  and status in ('present','absent','absent_morning','cutting_classes')
);
