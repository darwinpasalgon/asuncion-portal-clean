CREATE OR REPLACE FUNCTION public.update_adviser_student_information(p_student_id uuid, p_data jsonb)
 RETURNS learner_information
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_record public.learner_information;
  v_full_name text;
  v_middle_initial text;
  v_guardian_name text;
  v_mother_name text;
  v_father_name text;
  v_bool_text text;
begin
  if v_user_id is null then
    raise exception 'Authentication required.';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = v_user_id
      and p.role = 'teacher'
      and p.account_status = 'active'
  ) then
    raise exception 'Teacher access required.';
  end if;

  if not exists (
    select 1
    from public.student_enrollments se
    join public.school_years sy
      on sy.id = se.school_year_id
     and sy.is_active = true
    join public.section_advisers sa
      on sa.school_year_id = se.school_year_id
     and sa.section_id = se.section_id
     and sa.teacher_id = v_user_id
     and sa.is_active = true
    where se.student_id = p_student_id
      and se.enrollment_status = 'active'
  ) then
    raise exception 'You can only update learners in your active advisory section.';
  end if;

  if p_data is null or jsonb_typeof(p_data) <> 'object' then
    raise exception 'Learner information is required.';
  end if;

  if p_data ? 'sex'
     and nullif(btrim(p_data->>'sex'), '') is not null
     and upper(btrim(p_data->>'sex')) not in ('M','F') then
    raise exception 'Sex must be Male or Female.';
  end if;

  if p_data ? 'guardian_relationship'
     and nullif(btrim(p_data->>'guardian_relationship'),'') is not null
     and btrim(p_data->>'guardian_relationship') not in ('Parent','Relative','Non-relative') then
    raise exception 'Choose a valid Guardian relationship.';
  end if;

  if p_data ? 'mother_maiden_reason'
     and nullif(btrim(p_data->>'mother_maiden_reason'),'') is not null
     and btrim(p_data->>'mother_maiden_reason') not in ('No mother','Not disclosed') then
    raise exception 'Choose a valid reason for not specifying the mother''s maiden name.';
  end if;

  foreach v_bool_text in array array[
    'is_indigenous_peoples',
    'guardian_no_middle_name',
    'mother_no_middle_name',
    'father_no_middle_name',
    'permanent_same_as_current',
    'cct_recipient',
    'has_special_educational_needs',
    'vaccinated_covid19'
  ]
  loop
    if p_data ? v_bool_text
       and nullif(btrim(p_data->>v_bool_text),'') is not null
       and lower(btrim(p_data->>v_bool_text)) not in ('true','false') then
      raise exception 'Invalid Yes/No learner information value.';
    end if;
  end loop;

  if p_data ? 'learner_email'
     and nullif(btrim(p_data->>'learner_email'),'') is not null
     and btrim(p_data->>'learner_email') !~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then
    raise exception 'Enter a valid learner email address or leave it blank.';
  end if;

  if lower(coalesce(nullif(btrim(p_data->>'is_indigenous_peoples'),''),'false')) = 'true'
     and nullif(btrim(p_data->>'ethnic_group'),'') is null then
    raise exception 'Enter the learner''s primary ethnicity.';
  end if;

  if lower(coalesce(nullif(btrim(p_data->>'has_special_educational_needs'),''),'false')) = 'true'
     and nullif(btrim(p_data->>'lsen_type'),'') is null then
    raise exception 'Select the learner''s Special Educational Needs classification.';
  end if;

  if lower(coalesce(nullif(btrim(p_data->>'cct_recipient'),''),'false')) = 'true'
     and length(coalesce(nullif(btrim(p_data->>'cct_household_id'),''),'')) not between 12 and 21 then
    raise exception '4Ps Household ID must contain 12 to 21 characters.';
  end if;

  update public.learner_information li
  set
    last_name = case when p_data ? 'last_name' then nullif(btrim(p_data->>'last_name'),'') else li.last_name end,
    first_name = case when p_data ? 'first_name' then nullif(btrim(p_data->>'first_name'),'') else li.first_name end,
    middle_name = case when p_data ? 'middle_name' then nullif(btrim(p_data->>'middle_name'),'') else li.middle_name end,
    name_extension = case when p_data ? 'name_extension' then nullif(btrim(p_data->>'name_extension'),'') else li.name_extension end,
    sex = case when p_data ? 'sex' then nullif(upper(btrim(p_data->>'sex')),'') else li.sex end,
    birth_date = case when p_data ? 'birth_date' then nullif(btrim(p_data->>'birth_date'),'')::date else li.birth_date end,

    guardian_last_name = case when p_data ? 'guardian_last_name' then nullif(btrim(p_data->>'guardian_last_name'),'') else li.guardian_last_name end,
    guardian_first_name = case when p_data ? 'guardian_first_name' then nullif(btrim(p_data->>'guardian_first_name'),'') else li.guardian_first_name end,
    guardian_middle_name = case when p_data ? 'guardian_middle_name' then nullif(btrim(p_data->>'guardian_middle_name'),'') else li.guardian_middle_name end,
    guardian_no_middle_name = case when p_data ? 'guardian_no_middle_name' then nullif(btrim(p_data->>'guardian_no_middle_name'),'')::boolean else li.guardian_no_middle_name end,
    guardian_name_extension = case when p_data ? 'guardian_name_extension' then nullif(btrim(p_data->>'guardian_name_extension'),'') else li.guardian_name_extension end,
    guardian_name = case when p_data ? 'guardian_name' then nullif(btrim(p_data->>'guardian_name'),'') else li.guardian_name end,
    guardian_relationship = case when p_data ? 'guardian_relationship' then nullif(btrim(p_data->>'guardian_relationship'),'') else li.guardian_relationship end,
    guardian_contact_number = case when p_data ? 'guardian_contact_number' then nullif(btrim(p_data->>'guardian_contact_number'),'') else li.guardian_contact_number end,

    mother_last_name = case when p_data ? 'mother_last_name' then nullif(btrim(p_data->>'mother_last_name'),'') else li.mother_last_name end,
    mother_first_name = case when p_data ? 'mother_first_name' then nullif(btrim(p_data->>'mother_first_name'),'') else li.mother_first_name end,
    mother_middle_name = case when p_data ? 'mother_middle_name' then nullif(btrim(p_data->>'mother_middle_name'),'') else li.mother_middle_name end,
    mother_no_middle_name = case when p_data ? 'mother_no_middle_name' then nullif(btrim(p_data->>'mother_no_middle_name'),'')::boolean else li.mother_no_middle_name end,
    mother_name_extension = case when p_data ? 'mother_name_extension' then nullif(btrim(p_data->>'mother_name_extension'),'') else li.mother_name_extension end,
    mother_maiden_reason = case when p_data ? 'mother_maiden_reason' then nullif(btrim(p_data->>'mother_maiden_reason'),'') else li.mother_maiden_reason end,
    mother_maiden_name = case when p_data ? 'mother_maiden_name' then nullif(btrim(p_data->>'mother_maiden_name'),'') else li.mother_maiden_name end,

    father_last_name = case when p_data ? 'father_last_name' then nullif(btrim(p_data->>'father_last_name'),'') else li.father_last_name end,
    father_first_name = case when p_data ? 'father_first_name' then nullif(btrim(p_data->>'father_first_name'),'') else li.father_first_name end,
    father_middle_name = case when p_data ? 'father_middle_name' then nullif(btrim(p_data->>'father_middle_name'),'') else li.father_middle_name end,
    father_no_middle_name = case when p_data ? 'father_no_middle_name' then nullif(btrim(p_data->>'father_no_middle_name'),'')::boolean else li.father_no_middle_name end,
    father_name_extension = case when p_data ? 'father_name_extension' then nullif(btrim(p_data->>'father_name_extension'),'') else li.father_name_extension end,
    father_name = case when p_data ? 'father_name' then nullif(btrim(p_data->>'father_name'),'') else li.father_name end,

    mother_tongue = case when p_data ? 'mother_tongue' then nullif(btrim(p_data->>'mother_tongue'),'') else li.mother_tongue end,
    mother_tongue_secondary = case when p_data ? 'mother_tongue_secondary' then nullif(btrim(p_data->>'mother_tongue_secondary'),'') else li.mother_tongue_secondary end,
    mother_tongue_tertiary = case when p_data ? 'mother_tongue_tertiary' then nullif(btrim(p_data->>'mother_tongue_tertiary'),'') else li.mother_tongue_tertiary end,
    is_indigenous_peoples = case when p_data ? 'is_indigenous_peoples' then nullif(btrim(p_data->>'is_indigenous_peoples'),'')::boolean else li.is_indigenous_peoples end,
    ethnic_group = case when p_data ? 'ethnic_group' then nullif(btrim(p_data->>'ethnic_group'),'') else li.ethnic_group end,
    ethnicity_secondary = case when p_data ? 'ethnicity_secondary' then nullif(btrim(p_data->>'ethnicity_secondary'),'') else li.ethnicity_secondary end,
    religion = case when p_data ? 'religion' then nullif(btrim(p_data->>'religion'),'') else li.religion end,
    learner_email = case when p_data ? 'learner_email' then nullif(lower(btrim(p_data->>'learner_email')),'') else li.learner_email end,

    address_house_street_purok = case when p_data ? 'address_house_street_purok' then nullif(btrim(p_data->>'address_house_street_purok'),'') else li.address_house_street_purok end,
    address_barangay = case when p_data ? 'address_barangay' then nullif(btrim(p_data->>'address_barangay'),'') else li.address_barangay end,
    address_municipality_city = case when p_data ? 'address_municipality_city' then nullif(btrim(p_data->>'address_municipality_city'),'') else li.address_municipality_city end,
    address_province = case when p_data ? 'address_province' then nullif(btrim(p_data->>'address_province'),'') else li.address_province end,
    address_zip_code = case when p_data ? 'address_zip_code' then nullif(btrim(p_data->>'address_zip_code'),'') else li.address_zip_code end,

    permanent_same_as_current = case when p_data ? 'permanent_same_as_current' then nullif(btrim(p_data->>'permanent_same_as_current'),'')::boolean else li.permanent_same_as_current end,
    permanent_address_house_street_purok = case when p_data ? 'permanent_address_house_street_purok' then nullif(btrim(p_data->>'permanent_address_house_street_purok'),'') else li.permanent_address_house_street_purok end,
    permanent_address_barangay = case when p_data ? 'permanent_address_barangay' then nullif(btrim(p_data->>'permanent_address_barangay'),'') else li.permanent_address_barangay end,
    permanent_address_municipality_city = case when p_data ? 'permanent_address_municipality_city' then nullif(btrim(p_data->>'permanent_address_municipality_city'),'') else li.permanent_address_municipality_city end,
    permanent_address_province = case when p_data ? 'permanent_address_province' then nullif(btrim(p_data->>'permanent_address_province'),'') else li.permanent_address_province end,
    permanent_address_zip_code = case when p_data ? 'permanent_address_zip_code' then nullif(btrim(p_data->>'permanent_address_zip_code'),'') else li.permanent_address_zip_code end,
    permanent_address_other_barangay = case when p_data ? 'permanent_address_other_barangay' then nullif(btrim(p_data->>'permanent_address_other_barangay'),'') else li.permanent_address_other_barangay end,

    citizenship = case when p_data ? 'citizenship' then nullif(btrim(p_data->>'citizenship'),'') else li.citizenship end,
    cct_recipient = case when p_data ? 'cct_recipient' then nullif(btrim(p_data->>'cct_recipient'),'')::boolean else li.cct_recipient end,
    cct_household_id = case when p_data ? 'cct_household_id' then nullif(btrim(p_data->>'cct_household_id'),'') else li.cct_household_id end,
    has_special_educational_needs = case when p_data ? 'has_special_educational_needs' then nullif(btrim(p_data->>'has_special_educational_needs'),'')::boolean else li.has_special_educational_needs end,
    lsen_type = case when p_data ? 'lsen_type' then nullif(btrim(p_data->>'lsen_type'),'') else li.lsen_type end,
    vaccinated_covid19 = case when p_data ? 'vaccinated_covid19' then nullif(btrim(p_data->>'vaccinated_covid19'),'')::boolean else li.vaccinated_covid19 end,
    learning_modality = case when p_data ? 'learning_modality' then nullif(btrim(p_data->>'learning_modality'),'') else li.learning_modality end,
    remarks = case when p_data ? 'remarks' then nullif(btrim(p_data->>'remarks'),'') else li.remarks end,
    updated_by = v_user_id,
    updated_at = now()
  where li.student_id = p_student_id
  returning * into v_record;

  if v_record.student_id is null then
    raise exception 'Learner information record not found.';
  end if;

  if p_data ?| array['guardian_last_name','guardian_first_name','guardian_middle_name','guardian_no_middle_name','guardian_name_extension'] then
    v_guardian_name := concat_ws(
      ' ',
      nullif(btrim(v_record.guardian_first_name),''),
      case when coalesce(v_record.guardian_no_middle_name,false) then null else nullif(btrim(v_record.guardian_middle_name),'') end,
      nullif(btrim(v_record.guardian_last_name),''),
      nullif(btrim(v_record.guardian_name_extension),'')
    );
    update public.learner_information
      set guardian_name = nullif(btrim(v_guardian_name),'')
      where student_id = p_student_id
      returning * into v_record;
  end if;

  if p_data ?| array['mother_last_name','mother_first_name','mother_middle_name','mother_no_middle_name','mother_name_extension','mother_maiden_reason'] then
    if v_record.mother_maiden_reason is not null then
      v_mother_name := null;
    else
      v_mother_name := concat_ws(
        ' ',
        nullif(btrim(v_record.mother_first_name),''),
        case when coalesce(v_record.mother_no_middle_name,false) then null else nullif(btrim(v_record.mother_middle_name),'') end,
        nullif(btrim(v_record.mother_last_name),''),
        nullif(btrim(v_record.mother_name_extension),'')
      );
    end if;
    update public.learner_information
      set mother_maiden_name = nullif(btrim(v_mother_name),'')
      where student_id = p_student_id
      returning * into v_record;
  end if;

  if p_data ?| array['father_last_name','father_first_name','father_middle_name','father_no_middle_name','father_name_extension'] then
    v_father_name := concat_ws(
      ' ',
      nullif(btrim(v_record.father_first_name),''),
      case when coalesce(v_record.father_no_middle_name,false) then null else nullif(btrim(v_record.father_middle_name),'') end,
      nullif(btrim(v_record.father_last_name),''),
      nullif(btrim(v_record.father_name_extension),'')
    );
    update public.learner_information
      set father_name = nullif(btrim(v_father_name),'')
      where student_id = p_student_id
      returning * into v_record;
  end if;

  if v_record.permanent_same_as_current = true then
    update public.learner_information
       set permanent_address_house_street_purok = v_record.address_house_street_purok,
           permanent_address_barangay = v_record.address_barangay,
           permanent_address_municipality_city = v_record.address_municipality_city,
           permanent_address_province = v_record.address_province,
           permanent_address_zip_code = v_record.address_zip_code,
           permanent_address_other_barangay = null
     where student_id = p_student_id
     returning * into v_record;
  end if;

  if v_record.is_indigenous_peoples = false then
    update public.learner_information
       set ethnic_group = null,
           ethnicity_secondary = null
     where student_id = p_student_id
     returning * into v_record;
  end if;

  if v_record.cct_recipient = false then
    update public.learner_information
       set cct_household_id = null
     where student_id = p_student_id
     returning * into v_record;
  end if;

  if v_record.has_special_educational_needs = false then
    update public.learner_information
       set lsen_type = null
     where student_id = p_student_id
     returning * into v_record;
  end if;

  if p_data ? 'last_name'
     or p_data ? 'first_name'
     or p_data ? 'middle_name'
     or p_data ? 'name_extension' then
    v_middle_initial := case
      when nullif(btrim(v_record.middle_name),'') is not null
      then upper(left(btrim(v_record.middle_name),1)) || '.'
      else null
    end;

    v_full_name := concat_ws(
      ' ',
      nullif(btrim(v_record.first_name),''),
      v_middle_initial,
      nullif(btrim(v_record.last_name),''),
      nullif(btrim(v_record.name_extension),'')
    );

    if nullif(btrim(v_full_name),'') is not null then
      update public.profiles
      set full_name = upper(btrim(v_full_name)),
          updated_at = now()
      where id = p_student_id
        and role = 'student';
    end if;
  end if;

  return v_record;
end;
$function$;
revoke all on function public.update_adviser_student_information(uuid,jsonb) from public;
revoke all on function public.update_adviser_student_information(uuid,jsonb) from anon;
grant execute on function public.update_adviser_student_information(uuid,jsonb) to authenticated;
