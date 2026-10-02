begin;

update public.learner_information
set middle_name = null,
    updated_at = now()
where trim(coalesce(middle_name, '')) in ('-', '–', '—');

update public.learner_information
set first_name = trim(left(first_name, length(first_name) - 4)),
    name_extension = 'JR.',
    updated_at = now()
where trim(coalesce(name_extension, '')) = ''
  and upper(trim(first_name)) like '% JR.';

update public.learner_information
set first_name = trim(left(first_name, length(first_name) - 3)),
    name_extension = 'JR.',
    updated_at = now()
where trim(coalesce(name_extension, '')) = ''
  and upper(trim(first_name)) like '% JR';

update public.learner_information
set first_name = trim(left(first_name, length(first_name) - 4)),
    name_extension = 'SR.',
    updated_at = now()
where trim(coalesce(name_extension, '')) = ''
  and upper(trim(first_name)) like '% SR.';

update public.learner_information
set first_name = trim(left(first_name, length(first_name) - 3)),
    name_extension = 'SR.',
    updated_at = now()
where trim(coalesce(name_extension, '')) = ''
  and upper(trim(first_name)) like '% SR';

update public.learner_information
set first_name = trim(left(first_name, length(first_name) - 4)),
    name_extension = 'III',
    updated_at = now()
where trim(coalesce(name_extension, '')) = ''
  and upper(trim(first_name)) like '% III';

update public.learner_information
set first_name = trim(left(first_name, length(first_name) - 3)),
    name_extension = 'II',
    updated_at = now()
where trim(coalesce(name_extension, '')) = ''
  and upper(trim(first_name)) like '% II';

update public.learner_information
set first_name = trim(left(first_name, length(first_name) - 3)),
    name_extension = 'IV',
    updated_at = now()
where trim(coalesce(name_extension, '')) = ''
  and upper(trim(first_name)) like '% IV';

update public.learner_information
set first_name = trim(left(first_name, length(first_name) - 2)),
    name_extension = 'V',
    updated_at = now()
where trim(coalesce(name_extension, '')) = ''
  and upper(trim(first_name)) like '% V';

update public.learner_information
set name_extension = case
      when upper(replace(trim(name_extension), '.', '')) = 'JR' then 'JR.'
      when upper(replace(trim(name_extension), '.', '')) = 'SR' then 'SR.'
      else upper(trim(name_extension))
    end,
    updated_at = now()
where trim(coalesce(name_extension, '')) <> '';

update public.profiles p
set full_name = concat_ws(
      ' ',
      nullif(trim(li.first_name), ''),
      case
        when nullif(trim(li.middle_name), '') is not null
          then upper(left(trim(li.middle_name), 1)) || '.'
        else null
      end,
      nullif(trim(li.last_name), ''),
      nullif(trim(li.name_extension), '')
    ),
    updated_at = now()
from public.learner_information li
where li.student_id = p.id
  and p.role = 'student'
  and nullif(trim(li.first_name), '') is not null
  and nullif(trim(li.last_name), '') is not null;

commit;
