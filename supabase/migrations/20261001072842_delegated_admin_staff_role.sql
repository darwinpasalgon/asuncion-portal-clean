-- Use a separate internal role for delegated administrators so legacy
-- Super Administrator-only endpoints continue to reject them by default.

alter table public.profiles
  drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check
  check (
    role is null
    or role in ('student','teacher','administrator','staff_administrator')
  );

alter table public.profiles
  drop constraint if exists profiles_admin_role_check;
alter table public.profiles
  add constraint profiles_admin_role_check
  check (
    (role = 'administrator' and admin_role = 'super_administrator')
    or (
      role = 'staff_administrator'
      and admin_role in ('registrar','content_administrator','school_administrator')
    )
    or (
      role is distinct from 'administrator'
      and role is distinct from 'staff_administrator'
      and admin_role is null
    )
  );

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
          and p.role = 'staff_administrator'
          and p.account_status = 'active'
          and ap.permission = p_permission
      )
    );
$function$;

create or replace function private.is_active_portal_user()
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
      where p.id=(select auth.uid())
        and p.account_status='active'
        and p.role is not null
    );
$function$;

create or replace function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  requested text;
  portal_role text;
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
    portal_role := 'staff_administrator';
  elsif requested in ('student','teacher') then
    portal_role := requested;
  else
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
    id, full_name, email, recovery_phone, lrn, requested_role, role,
    account_status, grade_level, section, position, admin_role,
    must_change_password, temp_password_expires_at
  )
  values (
    new.id, display_name, lower(coalesce(new.email, '')), phone, new_lrn,
    requested, portal_role, 'active', new_grade, new_section, new_position,
    new_admin_role, true, null
  );

  return new;
end;
$function$;
