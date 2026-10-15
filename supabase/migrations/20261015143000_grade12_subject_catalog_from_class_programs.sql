-- Add all unique Grade 12 subjects represented by the two official SY 2026–2027
-- term workbooks to Teaching > Subjects, preserving original weekly periods.
-- Deduplicate unmistakable Excel misspellings and separate the combined
-- Organic Agriculture Production / Food Processing specialization.
with raw as (
  select distinct subject_label from public.grade12_term_periods
), normalized as (
  select case subject_label
    when 'ARAL PROGAM' then 'ARAL PROGRAM'
    when 'INTRODUCTION TO THE PHILOSOPHY OF HUMAN PERSON'
      then 'INTRODUCTION TO THE PHILOSOPHY OF THE HUMAN PERSON'
    when 'PRINIPLES OF MARKETING' then 'PRINCIPLES OF MARKETING'
    when 'ORGANIC AGRICULTURE PRODUCTION/FOOD PROCESSING'
      then 'ORGANIC AGRICULTURE PRODUCTION'
    when 'HGP/ARAL PROGRAM' then 'HGP'
    else subject_label end name
  from raw
  union all select 'FOOD PROCESSING'
)
insert into public.subjects
  (grade_level,name,code,is_active,grading_scheme,is_graded,include_in_school_forms)
select 12,name,null,true,
  case when name in ('CREATIVE WRITING','CREATIVE NON-FICTION') then 'shs_field_arts_creative'
       when name in ('PRACTICAL RESEARCH 2','INQUIRIES, INVESTIGATION AND IMMERSION') then 'shs_research_design'
       else 'shs_core_academic' end,
  case when name like 'ARAL %' or name='HGP' then false else true end,
  case when name like 'ARAL %' or name='HGP' then false else true end
from (select distinct name from normalized where name <> 'HGP') n
on conflict (grade_level,name) do nothing;

-- Correct obvious source typos without changing periods or teacher allocations.
update public.grade12_term_periods
set subject_label=case subject_label
  when 'ARAL PROGAM' then 'ARAL PROGRAM'
  when 'INTRODUCTION TO THE PHILOSOPHY OF HUMAN PERSON'
    then 'INTRODUCTION TO THE PHILOSOPHY OF THE HUMAN PERSON'
  when 'PRINIPLES OF MARKETING' then 'PRINCIPLES OF MARKETING'
  else subject_label end
where subject_label in (
  'ARAL PROGAM',
  'INTRODUCTION TO THE PHILOSOPHY OF HUMAN PERSON',
  'PRINIPLES OF MARKETING'
);

-- Future Grade 12 subject-name corrections made in the normal Teaching UI
-- update exact and two-track schedule labels in Term 1 and Term 2.
-- The trigger lives in private schema and is invoked only by a legitimate
-- subject table UPDATE; it is not callable as a public API.
create or replace function private.sync_grade12_subject_name_to_timetable()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.grade_level = 12
     and old.grade_level = 12
     and new.name is distinct from old.name then
    update public.grade12_term_periods p
    set subject_label = case
      when p.subject_label = old.name then new.name
      when strpos(p.subject_label, '/') > 0
           and split_part(p.subject_label,'/',1) = old.name
        then new.name || '/' || split_part(p.subject_label,'/',2)
      when strpos(p.subject_label, '/') > 0
           and split_part(p.subject_label,'/',2) = old.name
        then split_part(p.subject_label,'/',1) || '/' || new.name
      else p.subject_label end
    where p.subject_label=old.name or (
      strpos(p.subject_label, '/') > 0 and
      (split_part(p.subject_label,'/',1) = old.name or
       split_part(p.subject_label,'/',2) = old.name)
    );
  end if;
  return new;
end;
$$;
revoke all on function private.sync_grade12_subject_name_to_timetable() from public,anon,authenticated;
drop trigger if exists sync_grade12_subject_name_to_timetable on public.subjects;
create trigger sync_grade12_subject_name_to_timetable
after update of name on public.subjects
for each row execute function private.sync_grade12_subject_name_to_timetable();
