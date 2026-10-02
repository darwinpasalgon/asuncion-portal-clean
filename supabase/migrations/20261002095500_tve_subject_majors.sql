begin;

alter table public.teacher_assignments
  add column if not exists major text;

alter table public.teacher_assignments
  drop constraint if exists teacher_assignments_major_check;

alter table public.teacher_assignments
  add constraint teacher_assignments_major_check
  check (
    major is null or major in (
      'Computer Systems Servicing',
      'Electrical Installation and Maintenance',
      'Food Processing',
      'Animal Production',
      'Agriculture Crop Production'
    )
  );

update public.subjects
set code = null,
    updated_at = now()
where code is not null;

delete from public.subjects
where grade_level = 8
  and name in (
    'Computer Systems Servicing',
    'Electrical Installation and Maintenance'
  )
  and not exists (
    select 1
    from public.teacher_assignments ta
    where ta.subject_id = subjects.id
  );

insert into public.subjects (grade_level, name, code, is_active, grading_scheme)
values
  (7, 'Technical Vocational Education', null, true, 'ks23_tle_mapeh'),
  (8, 'Technical Vocational Education', null, true, 'ks23_tle_mapeh'),
  (9, 'Technical Vocational Education', null, true, 'ks23_tle_mapeh'),
  (10, 'Technical Vocational Education', null, true, 'ks23_tle_mapeh')
on conflict (grade_level, name) do update
set code = null,
    is_active = true,
    grading_scheme = excluded.grading_scheme,
    updated_at = now();

commit;
