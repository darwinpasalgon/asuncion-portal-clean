alter table public.student_enrollments
  add column if not exists learner_status text not null default 'active',
  add column if not exists status_note text,
  add column if not exists status_changed_at timestamptz,
  add column if not exists status_changed_by uuid references auth.users(id) on delete set null,
  add column if not exists source_enrollment_id uuid references public.student_enrollments(id) on delete set null;

alter table public.student_enrollments
  drop constraint if exists student_enrollments_learner_status_check;

alter table public.student_enrollments
  add constraint student_enrollments_learner_status_check
  check (
    learner_status = any (
      array[
        'active'::text,
        'transferred_in'::text,
        'transferred_out'::text,
        'dropped'::text,
        'graduated'::text,
        'retained'::text,
        'archived'::text
      ]
    )
  );

create table if not exists public.learner_enrollment_events (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  school_year_id uuid references public.school_years(id) on delete set null,
  enrollment_id uuid references public.student_enrollments(id) on delete set null,
  event_type text not null check (
    event_type = any (
      array[
        'enrolled'::text,
        'status_changed'::text,
        'section_changed'::text,
        'promoted'::text,
        'retained'::text,
        'transferred_in'::text,
        'transferred_out'::text,
        'dropped'::text,
        'graduated'::text,
        'archived'::text
      ]
    )
  ),
  from_grade_level smallint,
  from_section_id uuid references public.sections(id) on delete set null,
  to_grade_level smallint,
  to_section_id uuid references public.sections(id) on delete set null,
  from_status text,
  to_status text,
  note text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.learner_enrollment_events enable row level security;

drop policy if exists "Super administrators manage learner enrollment events"
  on public.learner_enrollment_events;
create policy "Super administrators manage learner enrollment events"
on public.learner_enrollment_events
for all
to authenticated
using ((select private.is_super_admin()))
with check ((select private.is_super_admin()));

drop policy if exists "Learners read own enrollment events"
  on public.learner_enrollment_events;
create policy "Learners read own enrollment events"
on public.learner_enrollment_events
for select
to authenticated
using (student_id = (select auth.uid()));

grant select on public.learner_enrollment_events to authenticated;
grant select, insert, update, delete on public.learner_enrollment_events to service_role;

create index if not exists student_enrollments_learner_status_idx
  on public.student_enrollments (school_year_id, learner_status);

create index if not exists learner_enrollment_events_student_idx
  on public.learner_enrollment_events (student_id, created_at desc);

create index if not exists learner_enrollment_events_school_year_idx
  on public.learner_enrollment_events (school_year_id, created_at desc);
