-- Atomic learner enrollment status changes with history.
-- Does not delete student accounts, class grades, or historical attendance.
create or replace function public.admin_change_learner_enrollment_status(
 p_enrollment_id uuid,
 p_status text,
 p_note text,
 p_effective_date date,
 p_actor_id uuid,
 p_expected_status text
) returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
 v_enrollment public.student_enrollments%rowtype;
 v_previous_status text;
 v_enrollment_status text;
 v_event_type text;
 v_effective_date date;
 v_is_superadmin boolean;
begin
 select exists (
   select 1 from public.profiles p
   where p.id=p_actor_id and p.role='administrator'
     and p.admin_role='super_administrator' and p.account_status='active'
 ) into v_is_superadmin;
 if not v_is_superadmin then raise exception 'Super Administrator access required.'; end if;
 if p_enrollment_id is null or p_status not in
   ('active','transferred_in','transferred_out','dropped','graduated','retained','archived')
 then raise exception 'Choose a valid learner enrollment and status.'; end if;
 if char_length(coalesce(p_note,'')) > 1000 then
   raise exception 'Status remarks must be 1,000 characters or fewer.';
 end if;
 v_effective_date := coalesce(p_effective_date, (now() at time zone 'Asia/Manila')::date);
 if v_effective_date > (now() at time zone 'Asia/Manila')::date then
   raise exception 'Status effective date cannot be in the future.';
 end if;

 select * into v_enrollment from public.student_enrollments
 where id=p_enrollment_id for update;
 if not found then raise exception 'Learner enrollment not found.'; end if;
 v_previous_status := coalesce(v_enrollment.learner_status,'active');
 if v_previous_status <> coalesce(p_expected_status,'active') then
   raise exception 'Enrollment status was changed by another administrator. Reload the learner record.';
 end if;
 if v_previous_status = p_status then
   raise exception 'Learner already has this status.';
 end if;
 if p_status='graduated' and v_enrollment.grade_level<>12 then
   raise exception 'Only Grade 12 learners can be marked Graduated.';
 end if;
 v_enrollment_status := case
   when p_status in ('active','transferred_in') then 'active'
   when p_status='transferred_out' then 'transferred'
   when p_status='dropped' then 'withdrawn'
   else 'completed' end;
 v_event_type := case when p_status='active' then 'status_changed' else p_status end;

 update public.student_enrollments
 set enrollment_status=v_enrollment_status,
     learner_status=p_status,
     status_note=nullif(trim(coalesce(p_note,'')),''),
     status_changed_at=(v_effective_date::timestamp + interval '12 hours') at time zone 'Asia/Manila',
     status_changed_by=p_actor_id,
     updated_at=now()
 where id=p_enrollment_id;

 insert into public.learner_enrollment_events (
   student_id,school_year_id,enrollment_id,event_type,from_grade_level,from_section_id,
   to_grade_level,to_section_id,from_status,to_status,note,created_by
 ) values (
   v_enrollment.student_id,v_enrollment.school_year_id,v_enrollment.id,
   v_event_type,v_enrollment.grade_level,v_enrollment.section_id,
   v_enrollment.grade_level,
   case when p_status in ('transferred_out','dropped') then null else v_enrollment.section_id end,
   v_previous_status,p_status,nullif(trim(coalesce(p_note,'')),''),p_actor_id
 );

 return jsonb_build_object(
   'ok',true,'enrollment_id',v_enrollment.id,'student_id',v_enrollment.student_id,
   'from_status',v_previous_status,'learner_status',p_status,
   'enrollment_status',v_enrollment_status,'section_id',v_enrollment.section_id,
   'effective_date',v_effective_date,
   'removed_from_active_roster',v_enrollment_status<>'active'
 );
end;
$$;
revoke all on function public.admin_change_learner_enrollment_status(uuid,text,text,date,uuid,text) from public,anon,authenticated;
grant execute on function public.admin_change_learner_enrollment_status(uuid,text,text,date,uuid,text) to service_role;