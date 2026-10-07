alter table public.learner_information
  add column if not exists learner_email text,
  add column if not exists guardian_last_name text,
  add column if not exists guardian_first_name text,
  add column if not exists guardian_middle_name text,
  add column if not exists guardian_no_middle_name boolean,
  add column if not exists guardian_name_extension text,
  add column if not exists mother_last_name text,
  add column if not exists mother_first_name text,
  add column if not exists mother_middle_name text,
  add column if not exists mother_no_middle_name boolean,
  add column if not exists mother_name_extension text,
  add column if not exists mother_maiden_reason text,
  add column if not exists father_last_name text,
  add column if not exists father_first_name text,
  add column if not exists father_middle_name text,
  add column if not exists father_no_middle_name boolean,
  add column if not exists father_name_extension text,
  add column if not exists is_indigenous_peoples boolean,
  add column if not exists ethnicity_secondary text,
  add column if not exists mother_tongue_secondary text,
  add column if not exists mother_tongue_tertiary text,
  add column if not exists address_zip_code text,
  add column if not exists permanent_same_as_current boolean,
  add column if not exists permanent_address_house_street_purok text,
  add column if not exists permanent_address_barangay text,
  add column if not exists permanent_address_municipality_city text,
  add column if not exists permanent_address_province text,
  add column if not exists permanent_address_zip_code text,
  add column if not exists permanent_address_other_barangay text,
  add column if not exists citizenship text,
  add column if not exists cct_recipient boolean,
  add column if not exists cct_household_id text,
  add column if not exists has_special_educational_needs boolean,
  add column if not exists lsen_type text,
  add column if not exists vaccinated_covid19 boolean;

comment on column public.learner_information.learner_email is 'Learner email address recorded in the LIS-style profile.';
comment on column public.learner_information.is_indigenous_peoples is 'Whether the learner is a member of ICC/IP; null means not yet recorded.';
comment on column public.learner_information.cct_recipient is 'Whether the learner is a Conditional Cash Transfer / 4Ps recipient; null means not yet recorded.';
comment on column public.learner_information.has_special_educational_needs is 'Whether the learner has special educational needs; null means not yet recorded.';
comment on column public.learner_information.vaccinated_covid19 is 'LIS-compatible COVID-19 vaccination response; null means not recorded.';
