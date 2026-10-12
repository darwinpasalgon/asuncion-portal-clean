create or replace function private.community_room_access(
  p_user_id uuid,
  p_room_type text,
  p_grade_level smallint,
  p_section_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_role text;
  v_school_year_id uuid;
  v_section_grade smallint;
begin
  select p.role
    into v_role
  from public.profiles p
  where p.id = p_user_id
    and p.account_status = 'active'
    and p.role is not null;

  if v_role is null then
    return false;
  end if;

  if p_room_type = 'school' then
    return p_grade_level is null and p_section_id is null;
  end if;

  if p_room_type = 'grade' then
    if p_grade_level not in (0,7,8,9,10,11,12) or p_section_id is not null then
      return false;
    end if;
  elsif p_room_type = 'section' then
    if p_section_id is null then
      return false;
    end if;

    select s.grade_level
      into v_section_grade
    from public.sections s
    where s.id = p_section_id
      and s.is_active = true;

    if v_section_grade is null
       or p_grade_level is distinct from v_section_grade then
      return false;
    end if;
  else
    return false;
  end if;

  if v_role = 'administrator' then
    return true;
  end if;

  select sy.id
    into v_school_year_id
  from public.school_years sy
  where sy.is_active = true
  order by sy.start_year desc
  limit 1;

  if v_school_year_id is null then
    return false;
  end if;

  if v_role = 'student' then
    if p_room_type = 'grade' then
      return exists (
        select 1
        from public.student_enrollments se
        where se.student_id = p_user_id
          and se.school_year_id = v_school_year_id
          and se.enrollment_status = 'active'
          and se.grade_level = p_grade_level
      );
    end if;

    return exists (
      select 1
      from public.student_enrollments se
      where se.student_id = p_user_id
        and se.school_year_id = v_school_year_id
        and se.enrollment_status = 'active'
        and se.grade_level = p_grade_level
        and se.section_id = p_section_id
    );
  end if;

  if v_role = 'teacher' then
    if p_room_type = 'grade' then
      return
        exists (
          select 1
          from public.teacher_assignments ta
          where ta.school_year_id = v_school_year_id
            and ta.is_active = true
            and ta.grade_level = p_grade_level
            and (
              ta.teacher_id = p_user_id
              or p_user_id = any(ta.co_teacher_ids)
            )
        )
        or exists (
          select 1
          from public.section_advisers sa
          join public.sections s on s.id = sa.section_id
          where sa.school_year_id = v_school_year_id
            and sa.is_active = true
            and sa.teacher_id = p_user_id
            and s.grade_level = p_grade_level
        )
        or exists (
          select 1
          from public.grade_level_heads glh
          where glh.profile_id = p_user_id
            and glh.grade_level = p_grade_level
        );
    end if;

    return exists (
      select 1
      from public.section_advisers sa
      where sa.school_year_id = v_school_year_id
        and sa.is_active = true
        and sa.teacher_id = p_user_id
        and sa.section_id = p_section_id
    );
  end if;

  return false;
end;
$function$;
