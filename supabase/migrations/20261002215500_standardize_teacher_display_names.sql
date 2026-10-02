begin;

update public.teacher_information ti
set personal = jsonb_set(coalesce(ti.personal,'{}'::jsonb), '{middle_name}', '""'::jsonb, true),
    updated_at = now()
from public.profiles p
where p.id = ti.teacher_id
  and p.role = 'teacher'
  and trim(coalesce(ti.personal->>'middle_name','')) in ('-', '–', '—');

update public.teacher_information ti
set personal = jsonb_set(
      jsonb_set(coalesce(ti.personal,'{}'::jsonb), '{first_name}',
        to_jsonb(trim(left(ti.personal->>'first_name', length(ti.personal->>'first_name') - 4))), true),
      '{name_extension}', to_jsonb('JR.'::text), true),
    updated_at = now()
from public.profiles p
where p.id = ti.teacher_id
  and p.role = 'teacher'
  and trim(coalesce(ti.personal->>'name_extension','')) = ''
  and upper(trim(coalesce(ti.personal->>'first_name',''))) like '% JR.';

update public.teacher_information ti
set personal = jsonb_set(
      jsonb_set(coalesce(ti.personal,'{}'::jsonb), '{first_name}',
        to_jsonb(trim(left(ti.personal->>'first_name', length(ti.personal->>'first_name') - 3))), true),
      '{name_extension}', to_jsonb('JR.'::text), true),
    updated_at = now()
from public.profiles p
where p.id = ti.teacher_id
  and p.role = 'teacher'
  and trim(coalesce(ti.personal->>'name_extension','')) = ''
  and upper(trim(coalesce(ti.personal->>'first_name',''))) like '% JR';

update public.teacher_information ti
set personal = jsonb_set(
      jsonb_set(coalesce(ti.personal,'{}'::jsonb), '{first_name}',
        to_jsonb(trim(left(ti.personal->>'first_name', length(ti.personal->>'first_name') - 4))), true),
      '{name_extension}', to_jsonb('SR.'::text), true),
    updated_at = now()
from public.profiles p
where p.id = ti.teacher_id
  and p.role = 'teacher'
  and trim(coalesce(ti.personal->>'name_extension','')) = ''
  and upper(trim(coalesce(ti.personal->>'first_name',''))) like '% SR.';

update public.teacher_information ti
set personal = jsonb_set(
      jsonb_set(coalesce(ti.personal,'{}'::jsonb), '{first_name}',
        to_jsonb(trim(left(ti.personal->>'first_name', length(ti.personal->>'first_name') - 3))), true),
      '{name_extension}', to_jsonb('SR.'::text), true),
    updated_at = now()
from public.profiles p
where p.id = ti.teacher_id
  and p.role = 'teacher'
  and trim(coalesce(ti.personal->>'name_extension','')) = ''
  and upper(trim(coalesce(ti.personal->>'first_name',''))) like '% SR';

update public.teacher_information ti
set personal = jsonb_set(
      jsonb_set(coalesce(ti.personal,'{}'::jsonb), '{first_name}',
        to_jsonb(trim(left(ti.personal->>'first_name', length(ti.personal->>'first_name') - 4))), true),
      '{name_extension}', to_jsonb('III'::text), true),
    updated_at = now()
from public.profiles p
where p.id = ti.teacher_id
  and p.role = 'teacher'
  and trim(coalesce(ti.personal->>'name_extension','')) = ''
  and upper(trim(coalesce(ti.personal->>'first_name',''))) like '% III';

update public.teacher_information ti
set personal = jsonb_set(
      jsonb_set(coalesce(ti.personal,'{}'::jsonb), '{first_name}',
        to_jsonb(trim(left(ti.personal->>'first_name', length(ti.personal->>'first_name') - 3))), true),
      '{name_extension}', to_jsonb('II'::text), true),
    updated_at = now()
from public.profiles p
where p.id = ti.teacher_id
  and p.role = 'teacher'
  and trim(coalesce(ti.personal->>'name_extension','')) = ''
  and upper(trim(coalesce(ti.personal->>'first_name',''))) like '% II';

update public.teacher_information ti
set personal = jsonb_set(
      jsonb_set(coalesce(ti.personal,'{}'::jsonb), '{first_name}',
        to_jsonb(trim(left(ti.personal->>'first_name', length(ti.personal->>'first_name') - 3))), true),
      '{name_extension}', to_jsonb('IV'::text), true),
    updated_at = now()
from public.profiles p
where p.id = ti.teacher_id
  and p.role = 'teacher'
  and trim(coalesce(ti.personal->>'name_extension','')) = ''
  and upper(trim(coalesce(ti.personal->>'first_name',''))) like '% IV';

update public.teacher_information ti
set personal = jsonb_set(
      jsonb_set(coalesce(ti.personal,'{}'::jsonb), '{first_name}',
        to_jsonb(trim(left(ti.personal->>'first_name', length(ti.personal->>'first_name') - 2))), true),
      '{name_extension}', to_jsonb('V'::text), true),
    updated_at = now()
from public.profiles p
where p.id = ti.teacher_id
  and p.role = 'teacher'
  and trim(coalesce(ti.personal->>'name_extension','')) = ''
  and upper(trim(coalesce(ti.personal->>'first_name',''))) like '% V';

update public.teacher_information ti
set personal = jsonb_set(
      coalesce(ti.personal,'{}'::jsonb),
      '{name_extension}',
      to_jsonb(
        case
          when upper(replace(trim(coalesce(ti.personal->>'name_extension','')),'.',''))='JR' then 'JR.'
          when upper(replace(trim(coalesce(ti.personal->>'name_extension','')),'.',''))='SR' then 'SR.'
          else upper(trim(coalesce(ti.personal->>'name_extension','')))
        end
      ),
      true
    ),
    updated_at = now()
from public.profiles p
where p.id = ti.teacher_id
  and p.role = 'teacher'
  and trim(coalesce(ti.personal->>'name_extension','')) <> '';

update public.profiles p
set full_name = concat_ws(
      ' ',
      nullif(trim(ti.personal->>'first_name'),''),
      case
        when nullif(trim(ti.personal->>'middle_name'),'') is not null
          then upper(left(trim(ti.personal->>'middle_name'),1)) || '.'
        else null
      end,
      nullif(trim(ti.personal->>'last_name'),''),
      nullif(trim(ti.personal->>'name_extension'),'')
    ),
    updated_at = now()
from public.teacher_information ti
where ti.teacher_id = p.id
  and p.role = 'teacher'
  and nullif(trim(ti.personal->>'first_name'),'') is not null
  and nullif(trim(ti.personal->>'last_name'),'') is not null;

commit;
