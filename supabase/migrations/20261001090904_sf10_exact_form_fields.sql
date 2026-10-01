alter table public.school_information
  add column if not exists school_head_designation text;

update public.school_information
set school_head_name = 'ALAN, JR. J. PAGLINAWAN',
    school_head_designation = 'Principal IV',
    school_id = '304217',
    district = 'Asuncion',
    division = 'Davao del Norte',
    region = 'Region XI - Davao Region',
    school_address = 'Purok 12, Cambanogoy, Asuncion, Davao del Norte',
    updated_at = now()
where id = true;

alter table public.learner_permanent_records
  add column if not exists jhs_completion_date date,
  add column if not exists jhs_school_name text,
  add column if not exists jhs_school_id text,
  add column if not exists jhs_school_address text,
  add column if not exists jhs_general_average numeric(5,2),
  add column if not exists shs_admission_date date,
  add column if not exists shs_track text,
  add column if not exists shs_strand text,
  add column if not exists awards_honors text,
  add column if not exists shs_graduation_date date,
  add column if not exists sf10_date_issued date;
