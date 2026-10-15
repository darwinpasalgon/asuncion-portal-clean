-- Verified database migration for transaction-safe personnel promotions.
CREATE OR REPLACE FUNCTION public.hr_change_personnel_designation(p_owner_type text, p_owner_id uuid, p_new_position text, p_reason text, p_changed_by uuid, p_expected_position text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_old text;
  v_name text;
  v_profile_id uuid;
  v_non_teaching_id uuid;
  v_result jsonb;
  v_authorized boolean;
begin
  select (
    (role = 'administrator' and admin_role = 'super_administrator')
    or (role = 'staff_administrator' and exists (
      select 1 from public.administrator_permissions ap
      where ap.administrator_id = p_changed_by and ap.permission = 'hr.manage'
    ))
  ) into v_authorized
  from public.profiles
  where id = p_changed_by and account_status = 'active';

  if coalesce(v_authorized,false) is not true then
    raise exception 'Human Resources access required.';
  end if;
  if p_owner_type not in ('teacher','non_teaching') or p_owner_id is null then
    raise exception 'Choose a valid personnel record.';
  end if;
  if p_new_position is null or length(trim(p_new_position)) < 3 or length(p_new_position)>120 then
    raise exception 'Choose a valid position.';
  end if;
  if length(trim(coalesce(p_reason,''))) < 3 or length(p_reason)>500 then
    raise exception 'Specify the appointment or promotion reason.';
  end if;

  if p_owner_type = 'teacher' then
    select p.full_name, p.position into v_name, v_old
    from public.profiles p
    where p.id=p_owner_id and p.account_status='active'
      and p.role in ('teacher','staff_administrator','administrator')
    for update;
    if not found then raise exception 'Active personnel account not found.'; end if;
    v_profile_id := p_owner_id;
    select nt.id into v_non_teaching_id
    from public.non_teaching_personnel nt
    where nt.portal_user_id = p_owner_id and nt.is_active = true;
  else
    select nt.full_name, nt.position, nt.portal_user_id
      into v_name, v_old, v_profile_id
    from public.non_teaching_personnel nt
    where nt.id=p_owner_id and nt.is_active=true
    for update;
    if not found then raise exception 'Active non-teaching personnel not found.'; end if;
    v_non_teaching_id := p_owner_id;
  end if;

  v_old := upper(trim(coalesce(v_old,'')));
  if v_old is distinct from upper(trim(coalesce(p_expected_position,''))) then
    raise exception 'Position changed since this page loaded. Refresh before saving.';
  end if;
  if v_old=upper(trim(p_new_position)) then
    raise exception 'This position is already assigned.';
  end if;

  -- Sync every linked personnel view without changing portal role or academic assignments.
  if v_non_teaching_id is not null then
    update public.non_teaching_personnel
    set position=upper(trim(p_new_position)),updated_at=now()
    where id=v_non_teaching_id;
  end if;
  if v_profile_id is not null then
    update public.profiles
    set position=upper(trim(p_new_position)),updated_at=now()
    where id=v_profile_id;
  end if;

  insert into public.personnel_designation_history
    (personnel_id,non_teaching_personnel_id,previous_position,new_position,reason,changed_by)
  values (v_profile_id,v_non_teaching_id,nullif(v_old,''),upper(trim(p_new_position)),trim(p_reason),p_changed_by);

  v_result := jsonb_build_object(
    'id',p_owner_id,
    'full_name',v_name,
    'position',upper(trim(p_new_position)),
    'previous_position',nullif(v_old,''),
    'portal_user_id',v_profile_id,
    'non_teaching_personnel_id',v_non_teaching_id
  );
  return v_result;
end;
$function$

revoke all on function public.hr_change_personnel_designation(text,uuid,text,text,uuid,text) from public, anon, authenticated;
grant execute on function public.hr_change_personnel_designation(text,uuid,text,text,uuid,text) to service_role;
