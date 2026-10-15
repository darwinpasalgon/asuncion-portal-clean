create table if not exists public.personnel_designation_history (
 id uuid primary key default gen_random_uuid(),
 personnel_id uuid references public.profiles(id) on delete set null,
 non_teaching_personnel_id uuid references public.non_teaching_personnel(id) on delete set null,
 previous_position text,
 new_position text not null,
 reason text not null,
 changed_by uuid references public.profiles(id) on delete set null,
 changed_at timestamptz not null default now(),
 constraint designation_owner_required check (num_nonnulls(personnel_id,non_teaching_personnel_id)>=1)
);
alter table public.personnel_designation_history enable row level security;
revoke all on public.personnel_designation_history from anon,authenticated;
grant all on public.personnel_designation_history to service_role;