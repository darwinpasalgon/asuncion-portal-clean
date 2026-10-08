alter table public.student_term_grades
  add column if not exists music_arts_grade smallint,
  add column if not exists pe_health_grade smallint;

alter table public.student_term_grades
  drop constraint if exists student_term_grades_music_arts_grade_check,
  add constraint student_term_grades_music_arts_grade_check
    check (music_arts_grade is null or (music_arts_grade between 0 and 100)),
  drop constraint if exists student_term_grades_pe_health_grade_check,
  add constraint student_term_grades_pe_health_grade_check
    check (pe_health_grade is null or (pe_health_grade between 0 and 100));
