-- Flag both sides of genuine cross-section Grade 12 conflicts. Preserve
-- original time slots, subjects and teaching assignments for verification.
-- Exact same-subject combined TVL blocks are intentionally excluded here:
-- those remain flagged separately for confirmation of shared instruction.
with pairs as (
  select p.id a_id,q.id b_id
  from public.grade12_term_periods p
  join public.grade12_term_periods q
  on p.school_year_id=q.school_year_id
    and p.term_no=q.term_no
    and p.day_of_week=q.day_of_week
    and p.section_id<>q.section_id
    and p.id::text<q.id::text
    and p.start_time<q.end_time and q.start_time<p.end_time
    and p.instructor_ids&&q.instructor_ids
  where not (
    p.subject_label='ORGANIC AGRICULTURE PRODUCTION/FOOD PROCESSING'
    and q.subject_label='ORGANIC AGRICULTURE PRODUCTION/FOOD PROCESSING'
  )
), affected as (
 select a_id id from pairs union select b_id from pairs
)
update public.grade12_term_periods p
set needs_review=true,
review_reason=case
 when coalesce(p.review_reason,'') ilike '%Teacher time overlap with another Grade 12 section%'
 then p.review_reason
 when nullif(trim(p.review_reason),'') is null
 then 'Teacher time overlap with another Grade 12 section'
 else p.review_reason || '; Teacher time overlap with another Grade 12 section'
end
from affected a where p.id=a.id and (
p.needs_review is distinct from true
or coalesce(p.review_reason,'') not ilike '%Teacher time overlap with another Grade 12 section%'
);
