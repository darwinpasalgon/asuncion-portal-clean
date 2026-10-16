begin;
alter table public.sections drop constraint if exists sections_shs_program_code_check;
alter table public.sections add constraint sections_shs_program_code_check
 check (shs_program_code is null or (grade_level=11 and shs_program_code in
 ('STEM','TVL','BUSINESS_ENTREPRENEURSHIP','ASSH','TVL_OAP','TVL_FOOD_PROCESSING')));
update public.sections set shs_program_code='TVL',updated_at=now()
 where grade_level=11 and name='Amber' and shs_program_code is distinct from 'TVL';
alter table public.student_enrollments drop constraint if exists student_enrollments_shs_elective_group_check;
alter table public.student_enrollments add constraint student_enrollments_shs_elective_group_check
 check (shs_elective_group is null or (grade_level=11 and shs_elective_group in
 ('STEM_MEDICAL','STEM_ENGINEERING','TVL_OAP','TVL_FOOD_PROCESSING')));
alter table public.teacher_assignments drop constraint if exists teacher_assignments_major_check;
alter table public.teacher_assignments add constraint teacher_assignments_major_check
 check (major is null or
 (grade_level=11 and major in ('STEM_MEDICAL','STEM_ENGINEERING','TVL_OAP','TVL_FOOD_PROCESSING')) or
 (grade_level in (7,8,9,10) and major in
 ('Computer Systems Servicing','Electrical Installation and Maintenance',
 'Food Processing','Animal Production - Poultry','Animal Production - Swine','Agriculture Crop Production')));
create or replace function public.set_adviser_grade11_elective_group(p_enrollment_id uuid,p_group text)
 returns table(id uuid, student_id uuid, grade_level smallint, section_id uuid, shs_elective_group text)
 language plpgsql security definer set search_path=''
as $body$
declare target public.student_enrollments%rowtype;
        section_program text;
        normalized_group text;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 select * into target from public.student_enrollments
 where student_enrollments.id=p_enrollment_id for update;
 if target.id is null or target.grade_level<>11 or target.section_id is null
 or target.enrollment_status<>'active' then
  raise exception 'Active Grade 11 learner enrollment not found';
 end if;
 if not exists(select 1 from public.profiles p
    join public.section_advisers sa on sa.teacher_id=p.id
     and sa.school_year_id=target.school_year_id and sa.section_id=target.section_id
     and sa.is_active=true
    where p.id=auth.uid() and p.role='teacher' and p.account_status='active') then
  raise exception 'Only the active Section Adviser may update this learner major';
 end if;
 select s.shs_program_code into section_program from public.sections s
 where s.id=target.section_id and s.grade_level=11 and s.is_active=true;
 normalized_group:=nullif(trim(coalesce(p_group,'')),'');
 if section_program='STEM' and normalized_group is not null and
   normalized_group not in ('STEM_MEDICAL','STEM_ENGINEERING') then
  raise exception 'Select Medical or Engineering for this STEM section';
 elsif section_program='TVL' and normalized_group is not null and
   normalized_group not in ('TVL_FOOD_PROCESSING','TVL_OAP') then
  raise exception 'Select Food Processing or Organic Agriculture Production for this TVL section';
 elsif section_program not in ('STEM','TVL') then
  raise exception 'Only Grade 11 mixed STEM or TVL sections support adviser-managed major assignment';
 end if;
 if target.shs_elective_group is distinct from normalized_group and exists (
  select 1 from public.student_term_grades g
  join public.teacher_assignments ta on ta.id=g.teacher_assignment_id
  where g.student_id=target.student_id and ta.school_year_id=target.school_year_id
   and ta.section_id=target.section_id and ta.grade_level=11
   and ta.major in ('STEM_MEDICAL','STEM_ENGINEERING','TVL_FOOD_PROCESSING','TVL_OAP')
 ) then
  raise exception 'This learner already has elective grade records. Contact the administrator before changing the major.';
 end if;
 return query update public.student_enrollments e
 set shs_elective_group=normalized_group,updated_at=now()
 where e.id=target.id
 returning e.id,e.student_id,e.grade_level,e.section_id,e.shs_elective_group;
end
$body$;
revoke all on function public.set_adviser_grade11_elective_group(uuid,text) from public,anon;
grant execute on function public.set_adviser_grade11_elective_group(uuid,text) to authenticated;
commit;
