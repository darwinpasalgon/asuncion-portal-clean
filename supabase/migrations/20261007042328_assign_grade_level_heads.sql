with head_data(grade_level, email) as (
  values
    (7::smallint, 'teresita.quidilla@deped.gov.ph'),
    (8::smallint, 'jo-ann.vila@deped.gov.ph'),
    (9::smallint, 'junry.bibat@deped.gov.ph'),
    (10::smallint, 'divina.pelobello@deped.gov.ph'),
    (11::smallint, 'leah.enriquez001@deped.gov.ph'),
    (12::smallint, 'rolibeth.franco@deped.gov.ph')
),
resolved as (
  select
    h.grade_level,
    coalesce(p.id, ntp.portal_user_id) as profile_id,
    ntp.id as non_teaching_personnel_id,
    coalesce(p.full_name, ntp.full_name) as display_name
  from head_data h
  left join public.profiles p
    on lower(p.email) = lower(h.email)
   and p.account_status = 'active'
  left join public.non_teaching_personnel ntp
    on lower(ntp.email) = lower(h.email)
   and ntp.is_active = true
)
insert into public.grade_level_heads (
  grade_level, profile_id, non_teaching_personnel_id,
  display_name, is_active, updated_at
)
select
  grade_level, profile_id, non_teaching_personnel_id,
  display_name, true, now()
from resolved
where display_name is not null
on conflict (grade_level) do update
set profile_id = excluded.profile_id,
    non_teaching_personnel_id = excluded.non_teaching_personnel_id,
    display_name = excluded.display_name,
    is_active = true,
    updated_at = now();
