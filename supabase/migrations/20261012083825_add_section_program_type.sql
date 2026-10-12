alter table public.sections
  add column if not exists program_type text;

update public.sections
set
  program_type = 'ALS A&E',
  updated_at = now()
where grade_level = 0
  and program_type is distinct from 'ALS A&E';

update public.sections
set
  program_type = case
    when lower(trim(name)) = 'courage' then 'ALS-SHS'
    else 'Regular SHS'
  end,
  updated_at = now()
where grade_level = 12
  and program_type is null;

alter table public.sections
  drop constraint if exists sections_program_type_check;

alter table public.sections
  add constraint sections_program_type_check
  check (
    (grade_level = 0 and program_type = 'ALS A&E')
    or (grade_level between 7 and 10 and program_type is null)
    or (
      grade_level in (11, 12)
      and (
        program_type is null
        or program_type in ('Regular SHS', 'ALS-SHS')
      )
    )
  );

comment on column public.sections.program_type is
  'Section-level school program classification. Grade 0 uses ALS A&E; Grades 11-12 use Regular SHS or ALS-SHS; Grades 7-10 remain null.';
