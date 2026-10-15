-- Mixed Grade 12 TVL groups (Fidelity) have separate tracks but
-- student_enrollments has no Grade 12 major assignment yet. These subjects
-- must be listed for advisers, but bulk encoding must be withheld until the
-- individual learners' SHS specialization is known.
alter table public.grade12_term_gradebook
 add column if not exists requires_learner_group boolean not null default false;
update public.grade12_term_gradebook gb
set requires_learner_group=true,updated_at=now()
where exists(
  select 1 from public.grade12_term_periods p
  join public.subjects s on s.id=gb.subject_id
  where p.school_year_id=gb.school_year_id and p.section_id=gb.section_id
    and p.term_no=gb.term_no
    and p.subject_label='ORGANIC AGRICULTURE PRODUCTION/FOOD PROCESSING'
    and s.name in('ORGANIC AGRICULTURE PRODUCTION','FOOD PROCESSING')
);