create table if not exists public.grade7_tve_rotations (
 id uuid primary key default gen_random_uuid(),
 school_year_id uuid not null references public.school_years(id) on delete cascade,
 rotation_block text not null check (rotation_block in ('MORNING','MIDDAY','AFTERNOON')),
 group_label text not null,
 section_id uuid references public.sections(id) on delete cascade,
 phase_no smallint not null check (phase_no between 1 and 5),
 starts_on date not null,
 ends_on date not null,
 major_code text not null check (major_code in ('AGRI-CROP','ANIMAL','CSS','EIM','FOOD')),
 teacher_id uuid references public.profiles(id),
 non_teaching_personnel_id uuid references public.non_teaching_personnel(id),
 days_of_week smallint[] not null,
 start_time time without time zone not null,
 end_time time without time zone not null,
 is_active boolean not null default true,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint grade7_tve_rotation_dates_check check (ends_on >= starts_on),
 constraint grade7_tve_rotation_time_check check (end_time > start_time),
 constraint grade7_tve_rotation_instructor_check check (
   (teacher_id is not null and non_teaching_personnel_id is null) or
   (teacher_id is null and non_teaching_personnel_id is not null)
 ),
 constraint grade7_tve_rotation_unique unique (school_year_id,rotation_block,group_label,phase_no)
);
create index if not exists grade7_tve_rotations_section_idx on public.grade7_tve_rotations(school_year_id,section_id,starts_on,ends_on) where is_active=true;
create index if not exists grade7_tve_rotations_teacher_idx on public.grade7_tve_rotations(teacher_id,starts_on,ends_on) where is_active=true and teacher_id is not null;
create index if not exists grade7_tve_rotations_non_teaching_idx on public.grade7_tve_rotations(non_teaching_personnel_id,starts_on,ends_on) where is_active=true and non_teaching_personnel_id is not null;
alter table public.grade7_tve_rotations enable row level security;
grant select on public.grade7_tve_rotations to authenticated;
grant select,insert,update,delete on public.grade7_tve_rotations to service_role;
grant select,insert,update,delete on public.grade7_tve_rotations to authenticated;
drop policy if exists "Students read own Grade 7 TVE rotations" on public.grade7_tve_rotations;
create policy "Students read own Grade 7 TVE rotations" on public.grade7_tve_rotations for select to authenticated
using (section_id is not null and exists (
 select 1 from public.student_enrollments e where e.student_id=(select auth.uid())
 and e.school_year_id=grade7_tve_rotations.school_year_id and e.section_id=grade7_tve_rotations.section_id
 and e.grade_level=7 and e.enrollment_status='active'
));
drop policy if exists "Teachers read own Grade 7 TVE rotations" on public.grade7_tve_rotations;
create policy "Teachers read own Grade 7 TVE rotations" on public.grade7_tve_rotations for select to authenticated
using (teacher_id=(select auth.uid()));
drop policy if exists "Administrators manage Grade 7 TVE rotations" on public.grade7_tve_rotations;
create policy "Administrators manage Grade 7 TVE rotations" on public.grade7_tve_rotations for all to authenticated
using ((select private.has_admin_permission('teaching.manage'::text)) or (select private.has_admin_permission('schedules.manage'::text)))
with check ((select private.has_admin_permission('teaching.manage'::text)) or (select private.has_admin_permission('schedules.manage'::text)));
with ay as (select id from public.school_years where is_active=true limit 1)
delete from public.grade7_tve_rotations r using ay where r.school_year_id=ay.id;
with ay as (select id from public.school_years where is_active=true limit 1),
src(rotation_block,group_label,phase_no,starts_on,ends_on,major_code,instructor_kind,instructor_name,days_of_week,start_time,end_time) as (
 values ('MORNING','Gumamela',1,date '2026-06-15',date '2026-07-29','EIM','teacher','MARIFE R. REMORIN','{2,3,4,5}'::smallint[],time '08:30',time '10:30'),
('MORNING','Santan',1,date '2026-06-15',date '2026-07-29','ANIMAL','teacher','AIRES A. ESMA','{2,3,4,5}'::smallint[],time '08:30',time '10:30'),
('MORNING','Sunflower',1,date '2026-06-15',date '2026-07-29','AGRI-CROP','teacher','IVY ANN T. ALMEROL','{2,3,4,5}'::smallint[],time '08:30',time '10:30'),
('MORNING','Waterlily',1,date '2026-06-15',date '2026-07-29','FOOD','teacher','DARWIN S. QUILIZA','{2,3,4,5}'::smallint[],time '08:30',time '10:30'),
('MORNING','MIX',1,date '2026-06-15',date '2026-07-29','CSS','teacher','JACKIELOU G. TUQUIB','{2,3,4,5}'::smallint[],time '08:30',time '10:30'),
('MORNING','Gumamela',2,date '2026-07-30',date '2026-10-02','CSS','teacher','JACKIELOU G. TUQUIB','{2,3,4,5}'::smallint[],time '08:30',time '10:30'),
('MORNING','Santan',2,date '2026-07-30',date '2026-10-02','EIM','teacher','MARIFE R. REMORIN','{2,3,4,5}'::smallint[],time '08:30',time '10:30'),
('MORNING','Sunflower',2,date '2026-07-30',date '2026-10-02','ANIMAL','teacher','AIRES A. ESMA','{2,3,4,5}'::smallint[],time '08:30',time '10:30'),
('MORNING','Waterlily',2,date '2026-07-30',date '2026-10-02','AGRI-CROP','teacher','IVY ANN T. ALMEROL','{2,3,4,5}'::smallint[],time '08:30',time '10:30'),
('MORNING','MIX',2,date '2026-07-30',date '2026-10-02','FOOD','teacher','DARWIN S. QUILIZA','{2,3,4,5}'::smallint[],time '08:30',time '10:30'),
('MORNING','Gumamela',3,date '2026-10-05',date '2026-11-19','FOOD','teacher','DARWIN S. QUILIZA','{2,3,4,5}'::smallint[],time '08:30',time '10:30'),
('MORNING','Santan',3,date '2026-10-05',date '2026-11-19','CSS','teacher','JACKIELOU G. TUQUIB','{2,3,4,5}'::smallint[],time '08:30',time '10:30'),
('MORNING','Sunflower',3,date '2026-10-05',date '2026-11-19','EIM','teacher','MARIFE R. REMORIN','{2,3,4,5}'::smallint[],time '08:30',time '10:30'),
('MORNING','Waterlily',3,date '2026-10-05',date '2026-11-19','ANIMAL','teacher','AIRES A. ESMA','{2,3,4,5}'::smallint[],time '08:30',time '10:30'),
('MORNING','MIX',3,date '2026-10-05',date '2026-11-19','AGRI-CROP','teacher','IVY ANN T. ALMEROL','{2,3,4,5}'::smallint[],time '08:30',time '10:30'),
('MORNING','Gumamela',4,date '2026-11-20',date '2027-02-05','AGRI-CROP','teacher','IVY ANN T. ALMEROL','{2,3,4,5}'::smallint[],time '08:30',time '10:30'),
('MORNING','Santan',4,date '2026-11-20',date '2027-02-05','FOOD','teacher','DARWIN S. QUILIZA','{2,3,4,5}'::smallint[],time '08:30',time '10:30'),
('MORNING','Sunflower',4,date '2026-11-20',date '2027-02-05','CSS','teacher','JACKIELOU G. TUQUIB','{2,3,4,5}'::smallint[],time '08:30',time '10:30'),
('MORNING','Waterlily',4,date '2026-11-20',date '2027-02-05','EIM','teacher','MARIFE R. REMORIN','{2,3,4,5}'::smallint[],time '08:30',time '10:30'),
('MORNING','MIX',4,date '2026-11-20',date '2027-02-05','ANIMAL','teacher','AIRES A. ESMA','{2,3,4,5}'::smallint[],time '08:30',time '10:30'),
('MORNING','Gumamela',5,date '2027-02-08',date '2027-03-19','ANIMAL','teacher','AIRES A. ESMA','{2,3,4,5}'::smallint[],time '08:30',time '10:30'),
('MORNING','Santan',5,date '2027-02-08',date '2027-03-19','AGRI-CROP','teacher','IVY ANN T. ALMEROL','{2,3,4,5}'::smallint[],time '08:30',time '10:30'),
('MORNING','Sunflower',5,date '2027-02-08',date '2027-03-19','FOOD','teacher','DARWIN S. QUILIZA','{2,3,4,5}'::smallint[],time '08:30',time '10:30'),
('MORNING','Waterlily',5,date '2027-02-08',date '2027-03-19','CSS','teacher','JACKIELOU G. TUQUIB','{2,3,4,5}'::smallint[],time '08:30',time '10:30'),
('MORNING','MIX',5,date '2027-02-08',date '2027-03-19','EIM','teacher','MARIFE R. REMORIN','{2,3,4,5}'::smallint[],time '08:30',time '10:30'),
('MIDDAY','Dahlia',1,date '2026-06-15',date '2026-07-29','AGRI-CROP','teacher','IVY ANN T. ALMEROL','{2,3,4,5}'::smallint[],time '12:30',time '14:30'),
('MIDDAY','Rose',1,date '2026-06-15',date '2026-07-29','FOOD','teacher','CANDY AMOR P. BALDESCO','{2,3,4,5}'::smallint[],time '12:30',time '14:30'),
('MIDDAY','Sampaguita',1,date '2026-06-15',date '2026-07-29','ANIMAL','teacher','AIRES A. ESMA','{2,3,4,5}'::smallint[],time '12:30',time '14:30'),
('MIDDAY','Zinnia',1,date '2026-06-15',date '2026-07-29','CSS','teacher','JESTONI D. MANLIGUIS','{2,3,4,5}'::smallint[],time '12:30',time '14:30'),
('MIDDAY','MIX',1,date '2026-06-15',date '2026-07-29','EIM','teacher','JEMBOY C. MAUREAL','{2,3,4,5}'::smallint[],time '12:30',time '14:30'),
('MIDDAY','Dahlia',2,date '2026-07-30',date '2026-10-02','EIM','teacher','JEMBOY C. MAUREAL','{2,3,4,5}'::smallint[],time '12:30',time '14:30'),
('MIDDAY','Rose',2,date '2026-07-30',date '2026-10-02','AGRI-CROP','teacher','IVY ANN T. ALMEROL','{2,3,4,5}'::smallint[],time '12:30',time '14:30'),
('MIDDAY','Sampaguita',2,date '2026-07-30',date '2026-10-02','FOOD','teacher','CANDY AMOR P. BALDESCO','{2,3,4,5}'::smallint[],time '12:30',time '14:30'),
('MIDDAY','Zinnia',2,date '2026-07-30',date '2026-10-02','ANIMAL','teacher','AIRES A. ESMA','{2,3,4,5}'::smallint[],time '12:30',time '14:30'),
('MIDDAY','MIX',2,date '2026-07-30',date '2026-10-02','CSS','teacher','JESTONI D. MANLIGUIS','{2,3,4,5}'::smallint[],time '12:30',time '14:30'),
('MIDDAY','Dahlia',3,date '2026-10-05',date '2026-11-19','CSS','teacher','JESTONI D. MANLIGUIS','{2,3,4,5}'::smallint[],time '12:30',time '14:30'),
('MIDDAY','Rose',3,date '2026-10-05',date '2026-11-19','EIM','teacher','JEMBOY C. MAUREAL','{2,3,4,5}'::smallint[],time '12:30',time '14:30'),
('MIDDAY','Sampaguita',3,date '2026-10-05',date '2026-11-19','AGRI-CROP','teacher','IVY ANN T. ALMEROL','{2,3,4,5}'::smallint[],time '12:30',time '14:30'),
('MIDDAY','Zinnia',3,date '2026-10-05',date '2026-11-19','FOOD','teacher','CANDY AMOR P. BALDESCO','{2,3,4,5}'::smallint[],time '12:30',time '14:30'),
('MIDDAY','MIX',3,date '2026-10-05',date '2026-11-19','ANIMAL','teacher','AIRES A. ESMA','{2,3,4,5}'::smallint[],time '12:30',time '14:30'),
('MIDDAY','Dahlia',4,date '2026-11-20',date '2027-02-05','ANIMAL','teacher','AIRES A. ESMA','{2,3,4,5}'::smallint[],time '12:30',time '14:30'),
('MIDDAY','Rose',4,date '2026-11-20',date '2027-02-05','CSS','teacher','JESTONI D. MANLIGUIS','{2,3,4,5}'::smallint[],time '12:30',time '14:30'),
('MIDDAY','Sampaguita',4,date '2026-11-20',date '2027-02-05','EIM','teacher','JEMBOY C. MAUREAL','{2,3,4,5}'::smallint[],time '12:30',time '14:30'),
('MIDDAY','Zinnia',4,date '2026-11-20',date '2027-02-05','AGRI-CROP','teacher','IVY ANN T. ALMEROL','{2,3,4,5}'::smallint[],time '12:30',time '14:30'),
('MIDDAY','MIX',4,date '2026-11-20',date '2027-02-05','FOOD','teacher','CANDY AMOR P. BALDESCO','{2,3,4,5}'::smallint[],time '12:30',time '14:30'),
('MIDDAY','Dahlia',5,date '2027-02-08',date '2027-03-19','FOOD','teacher','CANDY AMOR P. BALDESCO','{2,3,4,5}'::smallint[],time '12:30',time '14:30'),
('MIDDAY','Rose',5,date '2027-02-08',date '2027-03-19','ANIMAL','teacher','AIRES A. ESMA','{2,3,4,5}'::smallint[],time '12:30',time '14:30'),
('MIDDAY','Sampaguita',5,date '2027-02-08',date '2027-03-19','CSS','teacher','JESTONI D. MANLIGUIS','{2,3,4,5}'::smallint[],time '12:30',time '14:30'),
('MIDDAY','Zinnia',5,date '2027-02-08',date '2027-03-19','EIM','teacher','JEMBOY C. MAUREAL','{2,3,4,5}'::smallint[],time '12:30',time '14:30'),
('MIDDAY','MIX',5,date '2027-02-08',date '2027-03-19','AGRI-CROP','teacher','IVY ANN T. ALMEROL','{2,3,4,5}'::smallint[],time '12:30',time '14:30'),
('AFTERNOON','Daisy',1,date '2026-06-15',date '2026-07-29','AGRI-CROP','non_teaching','TERESITA LIPATA QUIDILLA','{1,2,3,4}'::smallint[],time '14:30',time '16:30'),
('AFTERNOON','Jasmine',1,date '2026-06-15',date '2026-07-29','FOOD','teacher','CANDY AMOR P. BALDESCO','{1,2,3,4}'::smallint[],time '14:30',time '16:30'),
('AFTERNOON','Rosal',1,date '2026-06-15',date '2026-07-29','CSS','teacher','JACKIELOU G. TUQUIB','{1,2,3,4}'::smallint[],time '14:30',time '16:30'),
('AFTERNOON','Vanda',1,date '2026-06-15',date '2026-07-29','ANIMAL','teacher','JESTONI D. MANLIGUIS','{1,2,3,4}'::smallint[],time '14:30',time '16:30'),
('AFTERNOON','MIX',1,date '2026-06-15',date '2026-07-29','EIM','teacher','RIZAN J. ARISCO','{1,2,3,4}'::smallint[],time '14:30',time '16:30'),
('AFTERNOON','Daisy',2,date '2026-07-30',date '2026-10-02','EIM','teacher','RIZAN J. ARISCO','{1,2,3,4}'::smallint[],time '14:30',time '16:30'),
('AFTERNOON','Jasmine',2,date '2026-07-30',date '2026-10-02','AGRI-CROP','non_teaching','TERESITA LIPATA QUIDILLA','{1,2,3,4}'::smallint[],time '14:30',time '16:30'),
('AFTERNOON','Rosal',2,date '2026-07-30',date '2026-10-02','FOOD','teacher','CANDY AMOR P. BALDESCO','{1,2,3,4}'::smallint[],time '14:30',time '16:30'),
('AFTERNOON','Vanda',2,date '2026-07-30',date '2026-10-02','CSS','teacher','JACKIELOU G. TUQUIB','{1,2,3,4}'::smallint[],time '14:30',time '16:30'),
('AFTERNOON','MIX',2,date '2026-07-30',date '2026-10-02','ANIMAL','teacher','JESTONI D. MANLIGUIS','{1,2,3,4}'::smallint[],time '14:30',time '16:30'),
('AFTERNOON','Daisy',3,date '2026-10-05',date '2026-11-19','ANIMAL','teacher','JESTONI D. MANLIGUIS','{1,2,3,4}'::smallint[],time '14:30',time '16:30'),
('AFTERNOON','Jasmine',3,date '2026-10-05',date '2026-11-19','EIM','teacher','RIZAN J. ARISCO','{1,2,3,4}'::smallint[],time '14:30',time '16:30'),
('AFTERNOON','Rosal',3,date '2026-10-05',date '2026-11-19','AGRI-CROP','non_teaching','TERESITA LIPATA QUIDILLA','{1,2,3,4}'::smallint[],time '14:30',time '16:30'),
('AFTERNOON','Vanda',3,date '2026-10-05',date '2026-11-19','FOOD','teacher','CANDY AMOR P. BALDESCO','{1,2,3,4}'::smallint[],time '14:30',time '16:30'),
('AFTERNOON','MIX',3,date '2026-10-05',date '2026-11-19','CSS','teacher','JACKIELOU G. TUQUIB','{1,2,3,4}'::smallint[],time '14:30',time '16:30'),
('AFTERNOON','Daisy',4,date '2026-11-20',date '2027-02-05','CSS','teacher','JACKIELOU G. TUQUIB','{1,2,3,4}'::smallint[],time '14:30',time '16:30'),
('AFTERNOON','Jasmine',4,date '2026-11-20',date '2027-02-05','ANIMAL','teacher','JESTONI D. MANLIGUIS','{1,2,3,4}'::smallint[],time '14:30',time '16:30'),
('AFTERNOON','Rosal',4,date '2026-11-20',date '2027-02-05','EIM','teacher','RIZAN J. ARISCO','{1,2,3,4}'::smallint[],time '14:30',time '16:30'),
('AFTERNOON','Vanda',4,date '2026-11-20',date '2027-02-05','AGRI-CROP','non_teaching','TERESITA LIPATA QUIDILLA','{1,2,3,4}'::smallint[],time '14:30',time '16:30'),
('AFTERNOON','MIX',4,date '2026-11-20',date '2027-02-05','FOOD','teacher','CANDY AMOR P. BALDESCO','{1,2,3,4}'::smallint[],time '14:30',time '16:30'),
('AFTERNOON','Daisy',5,date '2027-02-08',date '2027-03-19','FOOD','teacher','CANDY AMOR P. BALDESCO','{1,2,3,4}'::smallint[],time '14:30',time '16:30'),
('AFTERNOON','Jasmine',5,date '2027-02-08',date '2027-03-19','CSS','teacher','JACKIELOU G. TUQUIB','{1,2,3,4}'::smallint[],time '14:30',time '16:30'),
('AFTERNOON','Rosal',5,date '2027-02-08',date '2027-03-19','ANIMAL','teacher','JESTONI D. MANLIGUIS','{1,2,3,4}'::smallint[],time '14:30',time '16:30'),
('AFTERNOON','Vanda',5,date '2027-02-08',date '2027-03-19','EIM','teacher','RIZAN J. ARISCO','{1,2,3,4}'::smallint[],time '14:30',time '16:30'),
('AFTERNOON','MIX',5,date '2027-02-08',date '2027-03-19','AGRI-CROP','non_teaching','TERESITA LIPATA QUIDILLA','{1,2,3,4}'::smallint[],time '14:30',time '16:30')
),
resolved as (
 select ay.id school_year_id,src.*,s.id section_id,
 case when instructor_kind='teacher' then p.id end teacher_id,
 case when instructor_kind='non_teaching' then nt.id end non_teaching_personnel_id
 from src cross join ay
 left join public.sections s on upper(s.name)=upper(src.group_label) and s.grade_level=7 and s.is_active=true
 left join public.profiles p on instructor_kind='teacher' and upper(p.full_name)=upper(instructor_name) and p.role='teacher' and p.account_status='active'
 left join public.non_teaching_personnel nt on instructor_kind='non_teaching' and upper(nt.full_name)=upper(instructor_name) and nt.is_active=true
)
insert into public.grade7_tve_rotations(school_year_id,rotation_block,group_label,section_id,phase_no,starts_on,ends_on,major_code,teacher_id,non_teaching_personnel_id,instructor_name,days_of_week,start_time,end_time,is_active)
select school_year_id,rotation_block,group_label,section_id,phase_no,starts_on,ends_on,major_code,teacher_id,non_teaching_personnel_id,instructor_name,days_of_week,start_time,end_time,true
from resolved where (group_label='MIX' or section_id is not null)
and ((instructor_kind='teacher' and teacher_id is not null) or (instructor_kind='non_teaching' and non_teaching_personnel_id is not null));
