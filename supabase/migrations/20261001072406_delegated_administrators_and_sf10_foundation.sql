-- Delegated administrators and SF10 foundation.
-- Existing active administrator accounts become Super Administrators.

alter table public.profiles
  add column if not exists admin_role text;

update public.profiles
set admin_role = 'super_administrator',
    updated_at = now()
where role = 'administrator'
  and account_status = 'active'
  and admin_role is null;

alter table public.profiles
  drop constraint if exists profiles_admin_role_check;
alter table public.profiles
  add constraint profiles_admin_role_check
  check (
    (role = 'administrator' and admin_role in (
      'super_administrator',
      'registrar',
      'content_administrator',
      'school_administrator'
    ))
    or (role is distinct from 'administrator' and admin_role is null)
  );

alter table public.profiles
  drop constraint if exists profiles_requested_role_check;
alter table public.profiles
  add constraint profiles_requested_role_check
  check (requested_role in ('student','teacher','administrator'));

alter table public.profiles
  drop constraint if exists student_lrn_required;
alter table public.profiles
  add constraint student_lrn_required
  check (
    (requested_role = 'student' and lrn is not null and lrn ~ '^[0-9]{12}$')
    or (requested_role in ('teacher','administrator') and lrn is null)
  );

create table if not exists public.administrator_permissions (
  administrator_id uuid not null references public.profiles(id) on delete cascade,
  permission text not null check (permission in (
    'accounts.manage',
    'users.manage',
    'bulk_import.manage',
    'school_setup.manage',
    'teaching.manage',
    'schedules.manage',
    'attendance.manage',
    'reports.view',
    'announcements.manage',
    'resources.manage',
    'password_resets.manage',
    'sf10.manage'
  )),
  granted_by uuid references auth.users(id) on delete set null,
  granted_at timestamptz not null default now(),
  primary key (administrator_id, permission)
);

alter table public.administrator_permissions enable row level security;

create or replace function private.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select
    (select auth.uid()) is not null
    and exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.role = 'administrator'
        and p.account_status = 'active'
        and p.admin_role = 'super_administrator'
    );
$function$;

create or replace function private.has_admin_permission(p_permission text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select
    (select private.is_super_admin())
    or (
      (select auth.uid()) is not null
      and exists (
        select 1
        from public.profiles p
        join public.administrator_permissions ap
          on ap.administrator_id = p.id
        where p.id = (select auth.uid())
          and p.role = 'administrator'
          and p.account_status = 'active'
          and ap.permission = p_permission
      )
    );
$function$;

create or replace function private.is_active_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select private.is_super_admin();
$function$;

drop policy if exists "Super administrators manage administrator permissions"
  on public.administrator_permissions;
create policy "Super administrators manage administrator permissions"
on public.administrator_permissions
for all
to authenticated
using ((select private.is_super_admin()))
with check ((select private.is_super_admin()));

drop policy if exists "Administrators read own permissions"
  on public.administrator_permissions;
create policy "Administrators read own permissions"
on public.administrator_permissions
for select
to authenticated
using (administrator_id = (select auth.uid()));

grant select, insert, update, delete on public.administrator_permissions to authenticated;

create table if not exists public.school_information (
  id boolean primary key default true check (id = true),
  school_name text not null default 'Asuncion National High School',
  school_id text,
  district text,
  division text not null default 'Davao del Norte',
  region text not null default 'Region XI - Davao Region',
  school_address text,
  school_head_name text,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

insert into public.school_information (id, school_name, division, region)
values (true, 'Asuncion National High School', 'Davao del Norte', 'Region XI - Davao Region')
on conflict (id) do nothing;

alter table public.school_information enable row level security;

drop policy if exists "Authenticated users read school information" on public.school_information;
create policy "Authenticated users read school information"
on public.school_information
for select
to authenticated
using (true);

drop policy if exists "Super administrators manage school information" on public.school_information;
create policy "Super administrators manage school information"
on public.school_information
for all
to authenticated
using ((select private.is_super_admin()))
with check ((select private.is_super_admin()));

grant select, insert, update on public.school_information to authenticated;

create table if not exists public.learner_permanent_records (
  student_id uuid primary key references public.profiles(id) on delete cascade,
  last_name text,
  first_name text,
  middle_name text,
  name_extension text,
  birth_date date,
  sex text check (sex is null or sex in ('Male','Female')),
  elementary_school_name text,
  elementary_school_id text,
  elementary_school_address text,
  elementary_general_average numeric(5,2),
  elementary_citation text,
  eligibility_type text not null default 'elementary_completer'
    check (eligibility_type in ('elementary_completer','pept','a_and_e','other')),
  eligibility_rating text,
  eligibility_other text,
  assessment_date date,
  testing_center text,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

alter table public.learner_permanent_records enable row level security;

drop policy if exists "Super administrators manage learner permanent records"
  on public.learner_permanent_records;
create policy "Super administrators manage learner permanent records"
on public.learner_permanent_records
for all
to authenticated
using ((select private.is_super_admin()))
with check ((select private.is_super_admin()));

drop policy if exists "Registrar manages learner permanent records"
  on public.learner_permanent_records;
create policy "Registrar manages learner permanent records"
on public.learner_permanent_records
for all
to authenticated
using ((select private.has_admin_permission('sf10.manage')))
with check ((select private.has_admin_permission('sf10.manage')));

grant select, insert, update on public.learner_permanent_records to authenticated;

create table if not exists public.sf10_print_log (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete restrict,
  form_type text not null check (form_type in ('JHS','SHS')),
  printed_by uuid not null references auth.users(id) on delete restrict,
  printed_at timestamptz not null default now()
);

alter table public.sf10_print_log enable row level security;

drop policy if exists "Authorized administrators read SF10 print log" on public.sf10_print_log;
create policy "Authorized administrators read SF10 print log"
on public.sf10_print_log
for select
to authenticated
using ((select private.has_admin_permission('sf10.manage')));

drop policy if exists "Authorized administrators create SF10 print log" on public.sf10_print_log;
create policy "Authorized administrators create SF10 print log"
on public.sf10_print_log
for insert
to authenticated
with check (
  (select private.has_admin_permission('sf10.manage'))
  and printed_by = (select auth.uid())
);

grant select, insert on public.sf10_print_log to authenticated;

drop policy if exists "Registrar reads learner profiles for SF10" on public.profiles;
create policy "Registrar reads learner profiles for SF10"
on public.profiles
for select
to authenticated
using (
  role = 'student'
  and (select private.has_admin_permission('sf10.manage'))
);

drop policy if exists "Registrar reads enrollments for SF10" on public.student_enrollments;
create policy "Registrar reads enrollments for SF10"
on public.student_enrollments
for select
to authenticated
using ((select private.has_admin_permission('sf10.manage')));

drop policy if exists "Registrar reads grades for SF10" on public.student_term_grades;
create policy "Registrar reads grades for SF10"
on public.student_term_grades
for select
to authenticated
using ((select private.has_admin_permission('sf10.manage')));

drop policy if exists "Registrar reads teacher assignments for SF10" on public.teacher_assignments;
create policy "Registrar reads teacher assignments for SF10"
on public.teacher_assignments
for select
to authenticated
using ((select private.has_admin_permission('sf10.manage')));

drop policy if exists "Registrar reads section advisers for SF10" on public.section_advisers;
create policy "Registrar reads section advisers for SF10"
on public.section_advisers
for select
to authenticated
using ((select private.has_admin_permission('sf10.manage')));

create or replace function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  requested text;
  new_lrn text;
  phone text;
  display_name text;
  new_grade smallint;
  new_section text;
  new_position text;
  new_admin_role text;
  is_admin_provision boolean;
begin
  is_admin_provision :=
    coalesce(new.raw_app_meta_data ->> 'anhs_admin_provisioned', 'false') = 'true';

  if coalesce(new.raw_app_meta_data ->> 'anhs_provisioned', 'false') <> 'true'
     and not is_admin_provision then
    raise exception 'Public account creation is disabled. Contact the school administrator.';
  end if;

  requested := lower(trim(coalesce(new.raw_user_meta_data ->> 'requested_role', '')));

  if is_admin_provision then
    requested := 'administrator';
  elsif requested not in ('student', 'teacher') then
    raise exception 'Invalid portal role.';
  end if;

  display_name := trim(coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  if display_name = '' then
    raise exception 'Full name is required.';
  end if;

  phone := trim(coalesce(new.raw_user_meta_data ->> 'recovery_phone', ''));
  new_position := nullif(trim(coalesce(new.raw_user_meta_data ->> 'position', '')), '');

  if requested = 'student' then
    new_lrn := trim(coalesce(new.raw_user_meta_data ->> 'lrn', ''));
    if new_lrn !~ '^[0-9]{12}$' then
      raise exception 'Student LRN must contain exactly 12 digits.';
    end if;

    begin
      new_grade := trim(coalesce(new.raw_user_meta_data ->> 'grade_level', ''))::smallint;
    exception when others then
      raise exception 'A valid Grade Level is required.';
    end;

    if new_grade not between 7 and 12 then
      raise exception 'Grade Level must be from 7 to 12.';
    end if;

    new_section := nullif(trim(coalesce(new.raw_user_meta_data ->> 'section', '')), '');
    if new_section is null or not exists (
      select 1
      from public.sections
      where grade_level = new_grade
        and name = new_section
        and is_active = true
    ) then
      raise exception 'Student Section does not match an active section for the Grade Level.';
    end if;

    new_position := null;
    new_admin_role := null;
  elsif requested = 'teacher' then
    new_lrn := null;
    new_grade := null;
    new_section := null;
    new_admin_role := null;

    if coalesce(new.email, '') = '' then
      raise exception 'Teacher email is required.';
    end if;
    if new_position is null then
      new_position := 'Teacher';
    end if;
  else
    new_lrn := null;
    new_grade := null;
    new_section := null;

    if coalesce(new.email, '') = '' then
      raise exception 'Administrator email is required.';
    end if;

    new_admin_role := lower(trim(coalesce(new.raw_user_meta_data ->> 'admin_role', 'school_administrator')));
    if new_admin_role not in ('registrar','content_administrator','school_administrator') then
      raise exception 'Invalid delegated administrator role.';
    end if;

    if new_position is null then
      new_position := 'Administrator';
    end if;
  end if;

  insert into public.profiles (
    id,
    full_name,
    email,
    recovery_phone,
    lrn,
    requested_role,
    role,
    account_status,
    grade_level,
    section,
    position,
    admin_role,
    must_change_password,
    temp_password_expires_at
  )
  values (
    new.id,
    display_name,
    lower(coalesce(new.email, '')),
    phone,
    new_lrn,
    requested,
    requested,
    'active',
    new_grade,
    new_section,
    new_position,
    new_admin_role,
    true,
    null
  );

  return new;
end;
$function$;
