create table if not exists public.attendance_assistants (
  id uuid primary key default gen_random_uuid(),
  school_year_id uuid not null references public.school_years(id) on delete cascade,
  section_id uuid not null references public.sections(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  assigned_by uuid not null references auth.users(id) on delete restrict,
  is_active boolean not null default true,
  assigned_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_year_id, section_id, student_id)
);

create table if not exists public.attendance_section_roster (
  school_year_id uuid not null references public.school_years(id) on delete cascade,
  section_id uuid not null references public.sections(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  display_name text not null,
  sex text,
  updated_at timestamptz not null default now(),
  primary key (school_year_id, student_id)
);

create table if not exists public.attendance_assistant_entries (
  id uuid primary key default gen_random_uuid(),
  school_year_id uuid not null references public.school_years(id) on delete cascade,
  section_id uuid not null references public.sections(id) on delete cascade,
  attendance_date date not null,
  student_id uuid not null references public.profiles(id) on delete cascade,
  status text not null check (status in ('present','absent')),
  entered_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, school_year_id, attendance_date)
);

create index if not exists attendance_assistants_section_idx
  on public.attendance_assistants(school_year_id, section_id)
  where is_active=true;
create index if not exists attendance_assistants_student_idx
  on public.attendance_assistants(student_id, school_year_id)
  where is_active=true;
create index if not exists attendance_assistant_entries_section_date_idx
  on public.attendance_assistant_entries(school_year_id, section_id, attendance_date);
create index if not exists attendance_assistant_entries_entered_by_idx
  on public.attendance_assistant_entries(entered_by);
create index if not exists attendance_assistant_entries_section_id_idx
  on public.attendance_assistant_entries(section_id);
create index if not exists attendance_assistants_assigned_by_idx
  on public.attendance_assistants(assigned_by);
create index if not exists attendance_assistants_section_id_idx
  on public.attendance_assistants(section_id);
create index if not exists attendance_section_roster_section_id_idx
  on public.attendance_section_roster(section_id);
create index if not exists attendance_section_roster_student_id_idx
  on public.attendance_section_roster(student_id);

alter table public.attendance_assistants enable row level security;
alter table public.attendance_section_roster enable row level security;
alter table public.attendance_assistant_entries enable row level security;

revoke all on table public.attendance_assistants from anon;
revoke all on table public.attendance_section_roster from anon;
revoke all on table public.attendance_assistant_entries from anon;
revoke all on table public.attendance_assistants from authenticated;
revoke all on table public.attendance_section_roster from authenticated;
revoke all on table public.attendance_assistant_entries from authenticated;

grant select, insert, update, delete on table public.attendance_assistants to authenticated;
grant select on table public.attendance_section_roster to authenticated;
grant select, insert, update on table public.attendance_assistant_entries to authenticated;
grant all on table public.attendance_assistants to service_role;
grant all on table public.attendance_section_roster to service_role;
grant all on table public.attendance_assistant_entries to service_role;

create or replace function private.is_attendance_assistant_for_section(
  p_school_year_id uuid,
  p_section_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select auth.uid()) is not null
    and exists (
      select 1
      from public.attendance_assistants aa
      join public.profiles p on p.id=aa.student_id
      where aa.student_id=(select auth.uid())
        and aa.school_year_id=p_school_year_id
        and aa.section_id=p_section_id
        and aa.is_active=true
        and p.role='student'
        and p.account_status='active'
    );
$$;

revoke all on function private.is_attendance_assistant_for_section(uuid,uuid) from public;
grant execute on function private.is_attendance_assistant_for_section(uuid,uuid) to authenticated;

create or replace function private.validate_attendance_assistant()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_active_count integer;
begin
  if new.is_active then
    if not exists (
      select 1
      from public.profiles p
      join public.student_enrollments se on se.student_id=p.id
      where p.id=new.student_id
        and p.role='student'
        and p.account_status='active'
        and se.school_year_id=new.school_year_id
        and se.section_id=new.section_id
        and se.enrollment_status='active'
    ) then
      raise exception 'Attendance Assistant must be an active learner in the selected section.';
    end if;

    select count(*)
      into v_active_count
    from public.attendance_assistants aa
    where aa.school_year_id=new.school_year_id
      and aa.section_id=new.section_id
      and aa.is_active=true
      and aa.id is distinct from new.id;

    if v_active_count >= 3 then
      raise exception 'A section can have a maximum of 3 active Attendance Assistants.';
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

revoke all on function private.validate_attendance_assistant() from public;

drop trigger if exists validate_attendance_assistant on public.attendance_assistants;
create trigger validate_attendance_assistant
before insert or update on public.attendance_assistants
for each row execute function private.validate_attendance_assistant();

create or replace function private.sync_attendance_roster_from_enrollment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
  v_sex text;
begin
  if tg_op='DELETE' then
    delete from public.attendance_section_roster
    where school_year_id=old.school_year_id
      and student_id=old.student_id;
    return old;
  end if;

  if new.enrollment_status='active' and new.section_id is not null then
    select p.full_name, li.sex
      into v_name, v_sex
    from public.profiles p
    left join public.learner_information li on li.student_id=p.id
    where p.id=new.student_id;

    if v_name is not null then
      insert into public.attendance_section_roster(
        school_year_id, section_id, student_id, display_name, sex, updated_at
      )
      values(
        new.school_year_id, new.section_id, new.student_id, v_name, v_sex, now()
      )
      on conflict (school_year_id, student_id) do update
      set section_id=excluded.section_id,
          display_name=excluded.display_name,
          sex=excluded.sex,
          updated_at=now();
    end if;
  else
    delete from public.attendance_section_roster
    where school_year_id=new.school_year_id
      and student_id=new.student_id;
  end if;

  return new;
end;
$$;

revoke all on function private.sync_attendance_roster_from_enrollment() from public;

drop trigger if exists sync_attendance_roster_from_enrollment on public.student_enrollments;
create trigger sync_attendance_roster_from_enrollment
after insert or update or delete on public.student_enrollments
for each row execute function private.sync_attendance_roster_from_enrollment();

create or replace function private.sync_attendance_roster_profile_name()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.attendance_section_roster
  set display_name=new.full_name,
      updated_at=now()
  where student_id=new.id;
  return new;
end;
$$;

revoke all on function private.sync_attendance_roster_profile_name() from public;

drop trigger if exists sync_attendance_roster_profile_name on public.profiles;
create trigger sync_attendance_roster_profile_name
after update of full_name on public.profiles
for each row
when (old.full_name is distinct from new.full_name)
execute function private.sync_attendance_roster_profile_name();

create or replace function private.sync_attendance_roster_sex()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.attendance_section_roster
  set sex=new.sex,
      updated_at=now()
  where student_id=new.student_id;
  return new;
end;
$$;

revoke all on function private.sync_attendance_roster_sex() from public;

drop trigger if exists sync_attendance_roster_sex on public.learner_information;
create trigger sync_attendance_roster_sex
after update of sex on public.learner_information
for each row
when (old.sex is distinct from new.sex)
execute function private.sync_attendance_roster_sex();

insert into public.attendance_section_roster(
  school_year_id, section_id, student_id, display_name, sex, updated_at
)
select
  se.school_year_id,
  se.section_id,
  se.student_id,
  p.full_name,
  li.sex,
  now()
from public.student_enrollments se
join public.profiles p on p.id=se.student_id
left join public.learner_information li on li.student_id=se.student_id
where se.enrollment_status='active'
  and se.section_id is not null
  and p.role='student'
  and p.account_status='active'
on conflict (school_year_id, student_id) do update
set section_id=excluded.section_id,
    display_name=excluded.display_name,
    sex=excluded.sex,
    updated_at=now();

drop policy if exists "Advisers manage attendance assistants" on public.attendance_assistants;
create policy "Advisers manage attendance assistants"
on public.attendance_assistants
for all to authenticated
using ((select private.teacher_is_section_adviser(school_year_id, section_id)))
with check (
  (select private.teacher_is_section_adviser(school_year_id, section_id))
  and assigned_by=(select auth.uid())
);

drop policy if exists "Attendance assistants read own assignment" on public.attendance_assistants;
create policy "Attendance assistants read own assignment"
on public.attendance_assistants
for select to authenticated
using (student_id=(select auth.uid()) and is_active=true);

drop policy if exists "Attendance admins manage assistant assignments" on public.attendance_assistants;
create policy "Attendance admins manage assistant assignments"
on public.attendance_assistants
for all to authenticated
using ((select private.has_admin_permission('attendance.manage'::text)))
with check ((select private.has_admin_permission('attendance.manage'::text)));

drop policy if exists "Advisers read attendance roster" on public.attendance_section_roster;
create policy "Advisers read attendance roster"
on public.attendance_section_roster
for select to authenticated
using ((select private.teacher_is_section_adviser(school_year_id, section_id)));

drop policy if exists "Attendance assistants read section roster" on public.attendance_section_roster;
create policy "Attendance assistants read section roster"
on public.attendance_section_roster
for select to authenticated
using ((select private.is_attendance_assistant_for_section(school_year_id, section_id)));

drop policy if exists "Attendance admins read attendance roster" on public.attendance_section_roster;
create policy "Attendance admins read attendance roster"
on public.attendance_section_roster
for select to authenticated
using ((select private.has_admin_permission('attendance.manage'::text)));

drop policy if exists "Advisers read assistant entries" on public.attendance_assistant_entries;
create policy "Advisers read assistant entries"
on public.attendance_assistant_entries
for select to authenticated
using ((select private.teacher_is_section_adviser(school_year_id, section_id)));

drop policy if exists "Attendance assistants read section entries" on public.attendance_assistant_entries;
create policy "Attendance assistants read section entries"
on public.attendance_assistant_entries
for select to authenticated
using (
  (select private.is_attendance_assistant_for_section(school_year_id, section_id))
  and attendance_date=(now() at time zone 'Asia/Manila')::date
);

drop policy if exists "Attendance assistants insert section entries" on public.attendance_assistant_entries;
create policy "Attendance assistants insert section entries"
on public.attendance_assistant_entries
for insert to authenticated
with check (
  (select private.is_attendance_assistant_for_section(school_year_id, section_id))
  and attendance_date=(now() at time zone 'Asia/Manila')::date
  and entered_by=(select auth.uid())
  and status in ('present','absent')
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
  and status in ('present','absent')
);

drop policy if exists "Attendance admins read assistant entries" on public.attendance_assistant_entries;
create policy "Attendance admins read assistant entries"
on public.attendance_assistant_entries
for select to authenticated
using ((select private.has_admin_permission('attendance.manage'::text)));

drop policy if exists "Attendance assistants read section exclusions" on public.attendance_day_exclusions;
create policy "Attendance assistants read section exclusions"
on public.attendance_day_exclusions
for select to authenticated
using (
  (select private.is_attendance_assistant_for_section(school_year_id, section_id))
  and attendance_date=(now() at time zone 'Asia/Manila')::date
);
