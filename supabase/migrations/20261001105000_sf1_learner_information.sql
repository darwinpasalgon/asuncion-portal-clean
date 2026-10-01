create table if not exists public.learner_information (
  student_id uuid primary key references public.profiles(id) on delete cascade,
  last_name text,
  first_name text,
  middle_name text,
  name_extension text,
  sex text check (sex is null or sex in ('M','F')),
  birth_date date,
  mother_tongue text,
  ethnic_group text,
  religion text,
  address_house_street_purok text,
  address_barangay text,
  address_municipality_city text,
  address_province text,
  father_name text,
  mother_maiden_name text,
  guardian_name text,
  guardian_relationship text,
  guardian_contact_number text,
  learning_modality text,
  remarks text,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

alter table public.learner_information enable row level security;

drop policy if exists "Super administrators manage learner information"
  on public.learner_information;
create policy "Super administrators manage learner information"
on public.learner_information
for all
to authenticated
using ((select private.is_super_admin()))
with check ((select private.is_super_admin()));

drop policy if exists "Learners read own learner information"
  on public.learner_information;
create policy "Learners read own learner information"
on public.learner_information
for select
to authenticated
using (student_id = (select auth.uid()));

grant select, insert, update, delete on public.learner_information to authenticated;

create index if not exists learner_information_last_name_idx
  on public.learner_information (last_name);
create index if not exists learner_information_first_name_idx
  on public.learner_information (first_name);
