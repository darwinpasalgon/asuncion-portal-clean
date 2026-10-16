-- Keep the Grade 11 STEM section unified. Medical and Engineering are
-- learner elective subgroups, not different section programs.
begin;
alter table public.sections drop constraint if exists sections_shs_program_code_check;
update public.sections
set shs_program_code='STEM',updated_at=now()
where grade_level=11 and shs_program_code in ('STEM_MEDICAL','STEM_ENGINEERING');
alter table public.sections add constraint sections_shs_program_code_check
 check (shs_program_code is null or
 (grade_level=11 and shs_program_code in
 ('STEM','BUSINESS_ENTREPRENEURSHIP','ASSH','TVL_OAP','TVL_FOOD_PROCESSING')));

alter table public.student_enrollments add column if not exists shs_elective_group text;
alter table public.student_enrollments drop constraint if exists student_enrollments_shs_elective_group_check;
alter table public.student_enrollments add constraint student_enrollments_shs_elective_group_check
 check (shs_elective_group is null or
 (grade_level=11 and shs_elective_group in ('STEM_MEDICAL','STEM_ENGINEERING')));

alter table public.teacher_assignments drop constraint if exists teacher_assignments_major_check;
alter table public.teacher_assignments add constraint teacher_assignments_major_check
 check (major is null or
 (grade_level=11 and major in ('STEM_MEDICAL','STEM_ENGINEERING')) or
 (grade_level in (7,8,9,10) and major in
 ('Computer Systems Servicing','Electrical Installation and Maintenance',
 'Food Processing','Animal Production - Poultry','Animal Production - Swine',
 'Agriculture Crop Production')));
comment on column public.student_enrollments.shs_elective_group is
 'Learner elective subgroup within a unified Grade 11 STEM section.';
commit;
