create table if not exists public.account_provisioning_tokens (
  token text primary key,
  email text not null,
  requested_role text not null check (requested_role in ('student','teacher','administrator')),
  expires_at timestamptz not null,
  created_by uuid references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.account_provisioning_tokens enable row level security;

revoke all on table public.account_provisioning_tokens from public, anon, authenticated;
grant select, insert, delete on table public.account_provisioning_tokens to service_role;

create index if not exists account_provisioning_tokens_expires_idx
  on public.account_provisioning_tokens (expires_at);

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
  provisioning_token text;
  consumed_token text;
begin
  requested := lower(trim(coalesce(new.raw_user_meta_data ->> 'requested_role', '')));
  provisioning_token := trim(coalesce(new.raw_user_meta_data ->> 'provisioning_token', ''));

  if provisioning_token = '' then
    raise exception 'Public account creation is disabled. Contact the school administrator.';
  end if;

  delete from public.account_provisioning_tokens
  where token = provisioning_token
    and lower(email) = lower(coalesce(new.email, ''))
    and requested_role = requested
    and expires_at > now()
  returning token into consumed_token;

  if consumed_token is null then
    raise exception 'Account provisioning authorization is invalid or expired.';
  end if;

  if requested in ('student','teacher') then
    portal_role := requested;
  elsif requested = 'administrator' then
    portal_role := 'staff_administrator';
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
