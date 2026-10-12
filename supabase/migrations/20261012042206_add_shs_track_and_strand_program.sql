alter table public.student_enrollments
  add column if not exists shs_track text,
  add column if not exists shs_strand_program text;

alter table public.student_enrollments
  drop constraint if exists student_enrollments_grade12_shs_program_check;

alter table public.student_enrollments
  add constraint student_enrollments_grade12_shs_program_check
  check (
    grade_level <> 12
    or (shs_track is null and shs_strand_program is null)
    or (
      shs_track = 'Academic'
      and shs_strand_program in (
        'Science, Technology, Engineering, and Mathematics',
        'Humanities and Social Sciences',
        'Accountancy, Business, and Management'
      )
    )
    or (
      shs_track = 'Technical-Vocational-Livelihood'
      and shs_strand_program in (
        'Organic Agriculture Production',
        'Food Processing'
      )
    )
  );
