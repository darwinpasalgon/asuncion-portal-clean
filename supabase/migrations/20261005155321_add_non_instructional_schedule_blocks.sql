create table if not exists public.schedule_blocks (
  id uuid primary key default gen_random_uuid(),
  school_year_id uuid not null references public.school_years(id) on delete cascade,
  grade_level smallint not null check (grade_level between 7 and 12),
  section_id uuid not null references public.sections(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 1 and 7),
  start_time time without time zone not null,
  end_time time without time zone not null,
  label text not null,
  purpose text,
  block_type text not null default 'non_instructional'
    check (block_type in ('non_instructional')),
  is_active boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint schedule_blocks_valid_time check (end_time > start_time),
  constraint schedule_blocks_unique_entry
    unique (school_year_id, section_id, day_of_week, start_time, end_time, label)
);

create index if not exists schedule_blocks_school_year_section_idx
  on public.schedule_blocks (school_year_id, section_id, day_of_week, start_time)
  where is_active = true;

alter table public.schedule_blocks enable row level security;

grant select, insert, update, delete on table public.schedule_blocks to authenticated;
grant select, insert, update, delete on table public.schedule_blocks to service_role;

drop policy if exists "Students read own section schedule blocks" on public.schedule_blocks;
create policy "Students read own section schedule blocks"
on public.schedule_blocks
for select
to authenticated
using (
  exists (
    select 1
    from public.student_enrollments e
    where e.student_id = (select auth.uid())
      and e.school_year_id = schedule_blocks.school_year_id
      and e.section_id = schedule_blocks.section_id
      and e.enrollment_status = 'active'
  )
);

drop policy if exists "Administrators manage schedule blocks" on public.schedule_blocks;
create policy "Administrators manage schedule blocks"
on public.schedule_blocks
for all
to authenticated
using ((select private.has_admin_permission('schedules.manage'::text)))
with check ((select private.has_admin_permission('schedules.manage'::text)));

with ay as (
  select id from public.school_years where is_active = true limit 1
),
admin_user as (
  select id
  from public.profiles
  where role in ('administrator', 'staff_administrator')
    and account_status = 'active'
  order by case when role = 'administrator' then 0 else 1 end, created_at
  limit 1
)
insert into public.schedule_blocks (
  school_year_id, grade_level, section_id, day_of_week,
  start_time, end_time, label, purpose, block_type, is_active, created_by
)
select ay.id, 8, s.id, 5,
       time '15:30', time '16:30',
       'VACANT', 'Cleaning Time', 'non_instructional', true,
       (select id from admin_user)
from public.sections s
cross join ay
where s.grade_level = 8 and s.is_active = true
on conflict (school_year_id, section_id, day_of_week, start_time, end_time, label)
do update set
  purpose = excluded.purpose,
  block_type = excluded.block_type,
  is_active = true,
  updated_at = now();
