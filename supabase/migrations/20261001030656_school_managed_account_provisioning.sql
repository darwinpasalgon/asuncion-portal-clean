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
begin
  if coalesce(new.raw_app_meta_data ->> 'anhs_provisioned', 'false') <> 'true' then
    raise exception 'Public account creation is disabled. Contact the school administrator.';
  end if;

  requested := lower(trim(coalesce(new.raw_user_meta_data ->> 'requested_role', '')));
  if requested not in ('student', 'teacher') then
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
      select 1 from public.sections
      where grade_level = new_grade and name = new_section and is_active = true
    ) then
      raise exception 'Student Section does not match an active section for the Grade Level.';
    end if;

    new_position := null;
  else
    new_lrn := null;
    new_grade := null;
    new_section := null;
    if coalesce(new.email, '') = '' then raise exception 'Teacher email is required.'; end if;
    if new_position is null then new_position := 'Teacher'; end if;
  end if;

  insert into public.profiles (
    id, full_name, email, recovery_phone, lrn, requested_role, role,
    account_status, grade_level, section, position, must_change_password,
    temp_password_expires_at
  )
  values (
    new.id, display_name, lower(coalesce(new.email, '')), phone, new_lrn,
    requested, requested, 'active', new_grade, new_section, new_position,
    true, null
  );

  return new;
end;
$function$;

revoke all on function private.handle_new_auth_user() from public, anon, authenticated;
