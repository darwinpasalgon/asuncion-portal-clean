create table if not exists public.grade_level_heads (
  grade_level smallint primary key,
  profile_id uuid unique references public.profiles(id) on delete set null,
  non_teaching_personnel_id uuid unique references public.non_teaching_personnel(id) on delete set null,
  display_name text not null,
  is_active boolean not null default true,
  assigned_by uuid references auth.users(id) on delete set null,
  assigned_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint grade_level_heads_grade_level_check check (grade_level between 7 and 12)
);

alter table public.grade_level_heads enable row level security;

revoke all on table public.grade_level_heads from anon;
revoke insert, update, delete on table public.grade_level_heads from authenticated;
grant select on table public.grade_level_heads to authenticated;
grant all on table public.grade_level_heads to service_role;

create index if not exists grade_level_heads_profile_id_idx
  on public.grade_level_heads(profile_id)
  where profile_id is not null;

create index if not exists grade_level_heads_non_teaching_personnel_id_idx
  on public.grade_level_heads(non_teaching_personnel_id)
  where non_teaching_personnel_id is not null;

drop policy if exists "Grade level heads read own designation" on public.grade_level_heads;
create policy "Grade level heads read own designation"
on public.grade_level_heads
for select
to authenticated
using (
  profile_id = (select auth.uid())
  or (select private.is_super_admin())
  or (select private.has_admin_permission('teaching.manage'::text))
);

create or replace function private.current_grade_level_head()
returns smallint
language sql
stable
security definer
set search_path = ''
as $$
  select ghl.grade_level
  from public.grade_level_heads ghl
  join public.profiles p on p.id = ghl.profile_id
  where ghl.profile_id = (select auth.uid())
    and ghl.is_active = true
    and p.account_status = 'active'
  limit 1
$$;

revoke all on function private.current_grade_level_head() from public;
grant execute on function private.current_grade_level_head() to authenticated;

create or replace function private.is_grade_level_head_for_grade(target_grade smallint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select private.current_grade_level_head()) = target_grade, false)
$$;

revoke all on function private.is_grade_level_head_for_grade(smallint) from public;
grant execute on function private.is_grade_level_head_for_grade(smallint) to authenticated;

create or replace function private.is_grade_level_head_for_section(target_section uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.sections s
    where s.id = target_section
      and (select private.is_grade_level_head_for_grade(s.grade_level))
  )
$$;

revoke all on function private.is_grade_level_head_for_section(uuid) from public;
grant execute on function private.is_grade_level_head_for_section(uuid) to authenticated;

create or replace function private.sync_grade_level_head_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.grade_level_heads
  set profile_id = new.portal_user_id,
      updated_at = now()
  where non_teaching_personnel_id = new.id
    and profile_id is distinct from new.portal_user_id;
  return new;
end;
$$;

revoke all on function private.sync_grade_level_head_profile() from public;

drop trigger if exists sync_grade_level_head_profile on public.non_teaching_personnel;
create trigger sync_grade_level_head_profile
after insert or update of portal_user_id on public.non_teaching_personnel
for each row
execute function private.sync_grade_level_head_profile();

drop policy if exists "Grade level heads read grade enrollments" on public.student_enrollments;
create policy "Grade level heads read grade enrollments"
on public.student_enrollments for select to authenticated
using ((select private.is_grade_level_head_for_grade(grade_level)));

drop policy if exists "Grade level heads read learner information" on public.learner_information;
create policy "Grade level heads read learner information"
on public.learner_information for select to authenticated
using (
  exists (
    select 1 from public.student_enrollments se
    where se.student_id = learner_information.student_id
      and se.enrollment_status = 'active'
      and (select private.is_grade_level_head_for_grade(se.grade_level))
  )
);

drop policy if exists "Grade level heads read grade profiles" on public.profiles;
create policy "Grade level heads read grade profiles"
on public.profiles for select to authenticated
using (
  (
    role = 'student'
    and exists (
      select 1 from public.student_enrollments se
      where se.student_id = profiles.id
        and se.enrollment_status = 'active'
        and (select private.is_grade_level_head_for_grade(se.grade_level))
    )
  )
  or
  (
    role = 'teacher'
    and (
      exists (
        select 1 from public.teacher_assignments ta
        where (ta.teacher_id = profiles.id or profiles.id = any(ta.co_teacher_ids))
          and ta.is_active = true
          and (select private.is_grade_level_head_for_grade(ta.grade_level))
      )
      or exists (
        select 1
        from public.section_advisers sa
        join public.sections s on s.id = sa.section_id
        where sa.teacher_id = profiles.id
          and sa.is_active = true
          and (select private.is_grade_level_head_for_grade(s.grade_level))
      )
    )
  )
);

drop policy if exists "Grade level heads read attendance" on public.daily_attendance;
create policy "Grade level heads read attendance"
on public.daily_attendance for select to authenticated
using ((select private.is_grade_level_head_for_section(section_id)));

drop policy if exists "Grade level heads read attendance exclusions" on public.attendance_day_exclusions;
create policy "Grade level heads read attendance exclusions"
on public.attendance_day_exclusions for select to authenticated
using ((select private.is_grade_level_head_for_section(section_id)));

drop policy if exists "Grade level heads read advisers" on public.section_advisers;
create policy "Grade level heads read advisers"
on public.section_advisers for select to authenticated
using ((select private.is_grade_level_head_for_section(section_id)));

drop policy if exists "Grade level heads read teacher assignments" on public.teacher_assignments;
create policy "Grade level heads read teacher assignments"
on public.teacher_assignments for select to authenticated
using ((select private.is_grade_level_head_for_grade(grade_level)));

drop policy if exists "Grade level heads read class schedules" on public.class_schedules;
create policy "Grade level heads read class schedules"
on public.class_schedules for select to authenticated
using (
  exists (
    select 1 from public.teacher_assignments ta
    where ta.id = class_schedules.teacher_assignment_id
      and (select private.is_grade_level_head_for_grade(ta.grade_level))
  )
);

drop policy if exists "Grade level heads insert class schedules" on public.class_schedules;
create policy "Grade level heads insert class schedules"
on public.class_schedules for insert to authenticated
with check (
  exists (
    select 1 from public.teacher_assignments ta
    where ta.id = class_schedules.teacher_assignment_id
      and (select private.is_grade_level_head_for_grade(ta.grade_level))
  )
);

drop policy if exists "Grade level heads update class schedules" on public.class_schedules;
create policy "Grade level heads update class schedules"
on public.class_schedules for update to authenticated
using (
  exists (
    select 1 from public.teacher_assignments ta
    where ta.id = class_schedules.teacher_assignment_id
      and (select private.is_grade_level_head_for_grade(ta.grade_level))
  )
)
with check (
  exists (
    select 1 from public.teacher_assignments ta
    where ta.id = class_schedules.teacher_assignment_id
      and (select private.is_grade_level_head_for_grade(ta.grade_level))
  )
);

drop policy if exists "Grade level heads delete class schedules" on public.class_schedules;
create policy "Grade level heads delete class schedules"
on public.class_schedules for delete to authenticated
using (
  exists (
    select 1 from public.teacher_assignments ta
    where ta.id = class_schedules.teacher_assignment_id
      and (select private.is_grade_level_head_for_grade(ta.grade_level))
  )
);

drop policy if exists "Grade level heads read schedule blocks" on public.schedule_blocks;
create policy "Grade level heads read schedule blocks"
on public.schedule_blocks for select to authenticated
using ((select private.is_grade_level_head_for_grade(grade_level)));

drop policy if exists "Grade 7 head reads TVE rotations" on public.grade7_tve_rotations;
create policy "Grade 7 head reads TVE rotations"
on public.grade7_tve_rotations for select to authenticated
using ((select private.is_grade_level_head_for_grade(7::smallint)));

drop policy if exists "Grade level heads read term grades" on public.student_term_grades;
create policy "Grade level heads read term grades"
on public.student_term_grades for select to authenticated
using (
  exists (
    select 1 from public.teacher_assignments ta
    where ta.id = student_term_grades.teacher_assignment_id
      and (select private.is_grade_level_head_for_grade(ta.grade_level))
  )
);

drop policy if exists "Grade level heads read grade announcements" on public.announcements;
create policy "Grade level heads read grade announcements"
on public.announcements for select to authenticated
using (
  created_by = (select auth.uid())
  or (audience_scope = 'grade' and target_grade is not null and (select private.is_grade_level_head_for_grade(target_grade)))
  or (audience_scope = 'section' and target_section_id is not null and (select private.is_grade_level_head_for_section(target_section_id)))
);

drop policy if exists "Grade level heads create grade announcements" on public.announcements;
create policy "Grade level heads create grade announcements"
on public.announcements for insert to authenticated
with check (
  created_by = (select auth.uid())
  and announcement_type = 'announcement'
  and attachment_path is null
  and (
    (audience_scope = 'grade' and target_grade is not null and (select private.is_grade_level_head_for_grade(target_grade)))
    or
    (audience_scope = 'section' and target_section_id is not null and (select private.is_grade_level_head_for_section(target_section_id)))
  )
);

drop policy if exists "Grade level heads update own grade announcements" on public.announcements;
create policy "Grade level heads update own grade announcements"
on public.announcements for update to authenticated
using (
  created_by = (select auth.uid())
  and (
    (audience_scope = 'grade' and target_grade is not null and (select private.is_grade_level_head_for_grade(target_grade)))
    or
    (audience_scope = 'section' and target_section_id is not null and (select private.is_grade_level_head_for_section(target_section_id)))
  )
)
with check (
  created_by = (select auth.uid())
  and announcement_type = 'announcement'
  and attachment_path is null
  and (
    (audience_scope = 'grade' and target_grade is not null and (select private.is_grade_level_head_for_grade(target_grade)))
    or
    (audience_scope = 'section' and target_section_id is not null and (select private.is_grade_level_head_for_section(target_section_id)))
  )
);
