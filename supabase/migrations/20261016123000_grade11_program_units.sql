-- Grade 11 default program per section, plus optional SF9 subject credit units.
-- These fields do not modify student enrollment, grades or teacher assignments.
alter table public.sections add column if not exists shs_program_code text;
alter table public.sections drop constraint if exists sections_shs_program_code_check;
alter table public.sections add constraint sections_shs_program_code_check
  check (shs_program_code is null or (
    grade_level=11 and shs_program_code in (
      'STEM_MEDICAL','STEM_ENGINEERING','BUSINESS_ENTREPRENEURSHIP',
      'ASSH','TVL_OAP','TVL_FOOD_PROCESSING'
    )
  ));
alter table public.shs_subject_offerings add column if not exists units numeric(4,1);
alter table public.shs_subject_offerings drop constraint if exists shs_subject_offerings_units_check;
alter table public.shs_subject_offerings add constraint shs_subject_offerings_units_check
  check (units is null or (units >= 0 and units <= 20));
comment on column public.sections.shs_program_code is
  'Grade 11 section default specialization. Learner-specific program overrides for mixed sections.';
comment on column public.shs_subject_offerings.units is
  'SF9 credit units, NULL if not yet specified. Never assume zero.';
