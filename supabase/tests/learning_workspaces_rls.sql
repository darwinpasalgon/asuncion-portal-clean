do $probe$
declare
 owner_id uuid; other_teacher uuid; learner_id uuid; other_learner uuid; pending_tutor uuid; admin_id uuid;
 year_id uuid; target_section uuid;
 lesson_id uuid=gen_random_uuid(); pending_lesson uuid=gen_random_uuid();
 plan_id uuid=gen_random_uuid(); pending_plan uuid=gen_random_uuid(); fixture_session_id uuid=gen_random_uuid();
 n integer; failed boolean;
begin
 begin
  select p.id,e.student_id,e.school_year_id,e.section_id into owner_id,learner_id,year_id,target_section
  from public.profiles p cross join public.student_enrollments e
  join public.profiles s on s.id=e.student_id
  join public.school_years y on y.id=e.school_year_id
  where p.role='teacher' and p.account_status='active' and not p.must_change_password
   and s.role='student' and s.account_status='active' and not s.must_change_password
   and y.is_active and e.enrollment_status='active' and e.learner_status='active' and e.grade_level between 7 and 10
   and not exists(select 1 from public.teacher_assignments a where a.school_year_id=e.school_year_id and a.section_id=e.section_id and a.is_active and (a.teacher_id=p.id or p.id=any(a.co_teacher_ids)))
   and not exists(select 1 from public.section_advisers a where a.school_year_id=e.school_year_id and a.section_id=e.section_id and a.is_active and a.teacher_id=p.id)
  order by p.id,e.student_id limit 1;
  if owner_id is null then raise exception 'No suitable existing identities for the temporary authorization probe'; end if;
  select id into other_teacher from public.profiles where role='teacher' and account_status='active' and not must_change_password and id<>owner_id order by id limit 1;
  select id into other_learner from public.profiles where role='student' and account_status='active' and not must_change_password and id<>learner_id order by id limit 1;
  select p.id into pending_tutor from public.profiles p where p.role='teacher' and p.account_status='active' and p.must_change_password
    and not exists(select 1 from public.teacher_assignments a where a.school_year_id=year_id and a.section_id=target_section and a.is_active and (a.teacher_id=p.id or p.id=any(a.co_teacher_ids)))
    and not exists(select 1 from public.section_advisers a where a.school_year_id=year_id and a.section_id=target_section and a.is_active and a.teacher_id=p.id)
    order by p.id limit 1;
  select id into admin_id from public.profiles where role='administrator' and account_status='active' and not must_change_password limit 1;
  if other_teacher is null or other_learner is null or pending_tutor is null or admin_id is null then raise exception 'Authorization test identities are unavailable'; end if;

  insert into public.ilaw_lesson_plans(id,owner_id,title,subject,grade_level,term_no,week_no,content)
  values(lesson_id,owner_id,'Transaction-only authorization probe','Test',8,1,1,'{"sessions":[{}]}'),
        (pending_lesson,pending_tutor,'Transaction-only onboarding probe','Test',8,1,1,'{"sessions":[{}]}');

  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',jsonb_build_object('sub',admin_id,'role','authenticated')::text,true);
  insert into public.aral_support_plans(id,school_year_id,student_id,tutor_id,focus_area,target_skill,assessment_basis)
   values(plan_id,year_id,learner_id,owner_id,'Reading','Transaction-only test','Temporary verification; automatically rolled back'),
         (pending_plan,year_id,learner_id,pending_tutor,'Mathematics','Transaction-only test','Temporary verification; automatically rolled back');
  if (select student_name='' or tutor_name='' or grade_level not between 7 and 10 from public.aral_support_plans where id=plan_id) then raise exception 'ARAL assignment snapshots were not validated'; end if;

  perform set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'role','authenticated')::text,true);
  if (select count(*) from public.ilaw_lesson_plans where id=lesson_id)<>1 then raise exception 'Teacher cannot read own ILAW plan'; end if;
  if (select count(*) from public.aral_support_plans where id=plan_id)<>1 then raise exception 'Tutor cannot read own assignment'; end if;
  insert into public.aral_support_sessions(id,plan_id,session_date,activity,attendance,assessment_name,score,max_score)
    values(fixture_session_id,plan_id,current_date,'Transaction-only reading check','present','Test check',3,5);

  perform set_config('request.jwt.claims',jsonb_build_object('sub',other_teacher,'role','authenticated')::text,true);
  if (select count(*) from public.ilaw_lesson_plans where id=lesson_id)<>0 then raise exception 'Another teacher can read a private lesson'; end if;
  if (select count(*) from public.aral_support_plans where id=plan_id)<>0 then raise exception 'Another teacher can read an unassigned learner'; end if;
  if (select count(*) from public.aral_support_sessions where id=fixture_session_id)<>0 then raise exception 'Another teacher can read an unassigned session'; end if;
  update public.ilaw_lesson_plans set title='Unauthorized edit' where id=lesson_id;
  get diagnostics n=row_count;
  if n<>0 then raise exception 'Another teacher changed an owned lesson'; end if;

  perform set_config('request.jwt.claims',jsonb_build_object('sub',learner_id,'role','authenticated')::text,true);
  if (select count(*) from public.aral_support_plans where id=plan_id)<>1 then raise exception 'Learner cannot read own support'; end if;
  if (select count(*) from public.ilaw_lesson_plans where id=lesson_id)<>0 then raise exception 'Learner can read a private lesson plan'; end if;
  update public.aral_support_sessions set score=5,attendance='absent' where id=fixture_session_id;
  get diagnostics n=row_count;
  if n<>0 then raise exception 'Learner changed tutor scores or attendance'; end if;
  insert into public.aral_learner_responses(session_id,message,completed,needs_help)
    values(fixture_session_id,'Transaction-only learner response',false,true);
  failed=false;
  begin
   update public.aral_learner_responses set student_id=other_learner where aral_learner_responses.session_id=fixture_session_id;
  exception when insufficient_privilege then failed=true;
  end;
  if not failed then raise exception 'Learner identity is mutable'; end if;

  perform set_config('request.jwt.claims',jsonb_build_object('sub',other_learner,'role','authenticated')::text,true);
  if (select count(*) from public.aral_support_plans where id=plan_id)<>0 then raise exception 'A second learner can read another learner support'; end if;
  if (select count(*) from public.aral_learner_responses where aral_learner_responses.session_id=fixture_session_id)<>0 then raise exception 'A second learner can read another learner response'; end if;

  perform set_config('request.jwt.claims',jsonb_build_object('sub',pending_tutor,'role','authenticated')::text,true);
  if (select count(*) from public.ilaw_lesson_plans where id=pending_lesson)<>0 then raise exception 'First-login password change can be bypassed for ILAW'; end if;
  if (select count(*) from public.aral_support_plans where id=pending_plan)<>0 then raise exception 'First-login password change can be bypassed for ARAL'; end if;
  execute 'set local role postgres';
  raise exception using errcode='ZX001',message='Roll back transaction-only learning verification fixtures';
 exception when sqlstate 'ZX001' then
  perform set_config('anhs.learning_rls_probe','passed',true);
 end;
end;
$probe$;
select jsonb_build_object(
 'authorization_probe',current_setting('anhs.learning_rls_probe',true),
 'persisted_lesson_plans',(select count(*) from public.ilaw_lesson_plans),
 'persisted_aral_plans',(select count(*) from public.aral_support_plans),
 'persisted_aral_sessions',(select count(*) from public.aral_support_sessions),
 'persisted_learner_responses',(select count(*) from public.aral_learner_responses)
) as verification;
