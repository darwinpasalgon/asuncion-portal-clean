create table if not exists public.grade12_term_periods (
 id uuid primary key default gen_random_uuid(),
 school_year_id uuid not null references public.school_years(id) on delete restrict,
 section_id uuid not null references public.sections(id) on delete restrict,
 term_no smallint not null check (term_no between 1 and 3),
 day_of_week smallint not null check (day_of_week between 1 and 5),
 start_time time not null,end_time time not null,
 subject_label text not null,instructor_label text not null,
 instructor_ids uuid[] not null default '{}'::uuid[],
 track_label text,needs_review boolean not null default false,review_reason text,
 source_file text not null,source_sheet text not null,source_row int not null,
 imported_at timestamptz not null default now(),
 check (start_time >= time '07:30' and end_time <= time '16:45' and start_time < end_time),
 unique (school_year_id,section_id,term_no,day_of_week,source_row)
);
create index if not exists grade12_term_periods_year_term_section_idx on public.grade12_term_periods(school_year_id,term_no,section_id,day_of_week,start_time);
create index if not exists grade12_term_periods_instructor_ids_gin on public.grade12_term_periods using gin(instructor_ids);
alter table public.grade12_term_periods enable row level security;
grant select on public.grade12_term_periods to authenticated;
grant all on public.grade12_term_periods to service_role;
drop policy if exists "Authorized users read Grade 12 term class programs" on public.grade12_term_periods;
create policy "Authorized users read Grade 12 term class programs" on public.grade12_term_periods for select to authenticated using (
 (select private.has_admin_permission('schedules.manage'::text))
 or (select auth.uid()) = any(instructor_ids)
 or exists (select 1 from public.student_enrollments e where e.student_id=(select auth.uid()) and e.school_year_id=grade12_term_periods.school_year_id and e.section_id=grade12_term_periods.section_id and e.enrollment_status='active')
 or exists (select 1 from public.grade_level_heads h where h.profile_id=(select auth.uid()) and h.grade_level=12 and h.is_active)
);
