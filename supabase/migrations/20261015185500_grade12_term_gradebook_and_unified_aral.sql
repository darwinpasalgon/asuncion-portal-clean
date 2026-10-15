-- Normalize the ARAL learning support subject in Senior High School.
update public.subjects set is_graded=false,include_in_school_forms=false,updated_at=now()
where grade_level in(11,12) and (upper(name)='ARAL' or upper(name) like 'ARAL %');
update public.grade12_term_periods
set subject_label=case when upper(subject_label) like 'ARAL %' then 'ARAL'
when upper(subject_label) like 'HGP/ARAL %' then 'HGP/ARAL'
else subject_label end
where upper(subject_label) like 'ARAL %' or upper(subject_label) like 'HGP/ARAL %';
delete from public.subjects s where grade_level=12 and upper(name) like 'ARAL %'
 and not exists(select 1 from public.teacher_assignments ta where ta.subject_id=s.id);

create table if not exists public.grade12_term_gradebook (
 id uuid primary key default gen_random_uuid(),
 school_year_id uuid not null references public.school_years(id) on delete restrict,
 section_id uuid not null references public.sections(id) on delete restrict,
 subject_id uuid not null references public.subjects(id) on delete restrict,
 term_no smallint not null check(term_no in(1,2,3)),
 teacher_assignment_id uuid references public.teacher_assignments(id) on delete restrict,
 term_teacher_id uuid references public.profiles(id) on delete restrict,
 updated_at timestamptz not null default now(),
 unique(school_year_id,section_id,subject_id,term_no)
);
create index if not exists grade12_term_gradebook_term_idx on public.grade12_term_gradebook(school_year_id,section_id,term_no);
alter table public.grade12_term_gradebook enable row level security;
grant select on public.grade12_term_gradebook to authenticated;
grant all on public.grade12_term_gradebook to service_role;
drop policy if exists "View eligible Grade 12 term gradebook" on public.grade12_term_gradebook;
create policy "View eligible Grade 12 term gradebook" on public.grade12_term_gradebook
for select to authenticated using (
  exists(select 1 from public.section_advisers sa where sa.school_year_id=grade12_term_gradebook.school_year_id
    and sa.section_id=grade12_term_gradebook.section_id and sa.teacher_id=(select auth.uid()) and sa.is_active)
  or term_teacher_id=(select auth.uid())
  or exists(select 1 from public.student_enrollments se where se.school_year_id=grade12_term_gradebook.school_year_id
    and se.section_id=grade12_term_gradebook.section_id and se.student_id=(select auth.uid())
    and se.enrollment_status='active')
  or exists(select 1 from public.profiles pr where pr.id=(select auth.uid())
    and pr.role='administrator' and pr.account_status='active')
);
create or replace view private.grade12_timetable_grading_candidates with (security_invoker=true) as
select p.school_year_id,p.section_id,p.term_no,s.id as subject_id,
case when p.subject_label='ORGANIC AGRICULTURE PRODUCTION/FOOD PROCESSING' and s.name='ORGANIC AGRICULTURE PRODUCTION' then p.instructor_ids[1]
     when p.subject_label='ORGANIC AGRICULTURE PRODUCTION/FOOD PROCESSING' and s.name='FOOD PROCESSING' then p.instructor_ids[2]
     else p.instructor_ids[1] end as teacher_id
from public.grade12_term_periods p join public.subjects s
  on s.grade_level=12 and s.is_active and s.is_graded
  and (s.name=p.subject_label or
  (p.subject_label='ORGANIC AGRICULTURE PRODUCTION/FOOD PROCESSING'
    and s.name in ('ORGANIC AGRICULTURE PRODUCTION','FOOD PROCESSING')))
where p.term_no in (1,2);

-- One canonical teacher_assignment per section/subject, required by the
-- existing system's non-major unique index. Correct term instructors are
-- separately attached to Grade 12's term map.
with candidates as (
 select school_year_id,section_id,subject_id,teacher_id,term_no,count(*) as periods
 from private.grade12_timetable_grading_candidates
 where teacher_id is not null
 group by school_year_id,section_id,subject_id,teacher_id,term_no
), preferred as (
 select distinct on (school_year_id,section_id,subject_id)
 school_year_id,section_id,subject_id,teacher_id from candidates
 order by school_year_id,section_id,subject_id,term_no,periods desc,teacher_id
)
insert into public.teacher_assignments
(school_year_id,teacher_id,grade_level,section_id,subject_id,is_active,assigned_by,major)
select c.school_year_id,c.teacher_id,12,c.section_id,c.subject_id,true,
 (select id from public.profiles where role='administrator'
  and admin_role='super_administrator' and account_status='active' order by id limit 1),null
from preferred c join public.profiles p on p.id=c.teacher_id and p.account_status='active'
where not exists (select 1 from public.teacher_assignments ta
 where ta.school_year_id=c.school_year_id and ta.section_id=c.section_id
 and ta.subject_id=c.subject_id and ta.major is null);

with base as (
 select distinct school_year_id,section_id,term_no,subject_id from private.grade12_timetable_grading_candidates
), teachers as (
 select school_year_id,section_id,term_no,subject_id,
 case when count(distinct teacher_id)=1 and count(*) filter(where teacher_id is null)=0
 then max(teacher_id::text)::uuid else null end term_teacher_id
 from private.grade12_timetable_grading_candidates
 group by school_year_id,section_id,term_no,subject_id
)
insert into public.grade12_term_gradebook
(school_year_id,section_id,term_no,subject_id,teacher_assignment_id,term_teacher_id)
select b.school_year_id,b.section_id,b.term_no,b.subject_id,ta.id,t.term_teacher_id
from base b join teachers t on t.school_year_id=b.school_year_id and t.section_id=b.section_id and t.term_no=b.term_no and t.subject_id=b.subject_id
left join public.teacher_assignments ta on ta.school_year_id=b.school_year_id and ta.section_id=b.section_id
 and ta.subject_id=b.subject_id and ta.major is null and ta.is_active
on conflict(school_year_id,section_id,subject_id,term_no) do update
set teacher_assignment_id=excluded.teacher_assignment_id,
term_teacher_id=excluded.term_teacher_id,updated_at=now()
where public.grade12_term_gradebook.teacher_assignment_id is distinct from excluded.teacher_assignment_id
   or public.grade12_term_gradebook.term_teacher_id is distinct from excluded.term_teacher_id;
