-- Keep Grade 12 term gradebook teaching assignments synchronized when an
-- imported class-period instructor is corrected or newly provisioned.
-- This does not create, edit, or publish student grades.
create or replace function private.sync_grade12_term_teacher_on_period_edit()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
 v_subject record;
 v_teacher_id uuid;
 v_assignment_id uuid;
 v_distinct int;
 v_missing int;
begin
 if new.term_no not in (1,2) then return new; end if;
 for v_subject in
  select s.id,s.name from public.subjects s
  where s.grade_level=12 and s.is_active and s.is_graded
  and (s.name=new.subject_label or
  (new.subject_label='ORGANIC AGRICULTURE PRODUCTION/FOOD PROCESSING'
   and s.name in('ORGANIC AGRICULTURE PRODUCTION','FOOD PROCESSING')))
 loop
   select count(distinct chosen.teacher_id),
     count(*) filter(where chosen.teacher_id is null),
     max(chosen.teacher_id::text)::uuid
   into v_distinct,v_missing,v_teacher_id
   from (
     select case
      when p.subject_label='ORGANIC AGRICULTURE PRODUCTION/FOOD PROCESSING'
       and v_subject.name='ORGANIC AGRICULTURE PRODUCTION'
       then p.instructor_ids[1]
      when p.subject_label='ORGANIC AGRICULTURE PRODUCTION/FOOD PROCESSING'
       and v_subject.name='FOOD PROCESSING'
       then p.instructor_ids[2]
      else p.instructor_ids[1] end as teacher_id
     from public.grade12_term_periods p
     where p.school_year_id=new.school_year_id and p.section_id=new.section_id
     and p.term_no=new.term_no
     and (p.subject_label=v_subject.name or
      (p.subject_label='ORGANIC AGRICULTURE PRODUCTION/FOOD PROCESSING'
       and v_subject.name in('ORGANIC AGRICULTURE PRODUCTION','FOOD PROCESSING')))
   ) chosen;
   if v_distinct <> 1 or v_missing > 0 then v_teacher_id:=null; end if;
   select ta.id into v_assignment_id
   from public.teacher_assignments ta
   where ta.school_year_id=new.school_year_id and ta.section_id=new.section_id
     and ta.subject_id=v_subject.id and ta.grade_level=12
     and ta.major is null and ta.is_active
   limit 1;

   if v_assignment_id is null and v_teacher_id is not null
      and exists(select 1 from public.profiles pr where pr.id=v_teacher_id
        and pr.role='teacher' and pr.account_status='active') then
     insert into public.teacher_assignments
       (school_year_id,teacher_id,grade_level,section_id,subject_id,is_active,major)
     values(new.school_year_id,v_teacher_id,12,new.section_id,v_subject.id,true,null)
     on conflict do nothing;
     select ta.id into v_assignment_id from public.teacher_assignments ta
     where ta.school_year_id=new.school_year_id and ta.section_id=new.section_id
       and ta.subject_id=v_subject.id and ta.grade_level=12
       and ta.major is null and ta.is_active limit 1;
   end if;

   update public.grade12_term_gradebook gb
   set term_teacher_id=v_teacher_id,
     teacher_assignment_id=coalesce(v_assignment_id,gb.teacher_assignment_id),
     updated_at=now()
   where gb.school_year_id=new.school_year_id and gb.section_id=new.section_id
     and gb.term_no=new.term_no and gb.subject_id=v_subject.id
     and (gb.term_teacher_id is distinct from v_teacher_id
       or (v_assignment_id is not null
         and gb.teacher_assignment_id is distinct from v_assignment_id));
 end loop;
 return new;
end;
$$;
revoke all on function private.sync_grade12_term_teacher_on_period_edit() from public,anon,authenticated;
drop trigger if exists grade12_sync_term_teacher_after_edit on public.grade12_term_periods;
create trigger grade12_sync_term_teacher_after_edit
after update of instructor_ids on public.grade12_term_periods
for each row
when (old.instructor_ids is distinct from new.instructor_ids)
execute function private.sync_grade12_term_teacher_on_period_edit();