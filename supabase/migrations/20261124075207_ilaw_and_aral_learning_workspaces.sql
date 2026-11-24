create table public.ilaw_lesson_plans (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null default auth.uid() references public.profiles(id),
 title text not null check (char_length(title) between 1 and 180),
 subject text not null check (char_length(subject) between 1 and 120),
 grade_level smallint not null check (grade_level between 7 and 12),
 term_no smallint not null check (term_no between 1 and 3),
 week_no smallint not null check (week_no between 1 and 53),
 status text not null default 'draft' check (status in ('draft','ready','archived')),
 teacher_reviewed boolean not null default false,
 content jsonb not null check (jsonb_typeof(content)='object' and octet_length(content::text)<=220000
   and content ? 'sessions' and jsonb_typeof(content->'sessions')='array'
   and jsonb_array_length(content->'sessions') between 1 and 5),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check (status<>'ready' or teacher_reviewed)
);
create index ilaw_plans_owner_updated on public.ilaw_lesson_plans(owner_id,updated_at desc);

create table public.aral_support_plans (
 id uuid primary key default gen_random_uuid(),
 school_year_id uuid not null references public.school_years(id),
 student_id uuid not null references public.profiles(id),
 tutor_id uuid not null references public.profiles(id),
 student_name text not null default '',
 tutor_name text not null default '',
 grade_level smallint not null check (grade_level between 7 and 10),
 section_name text not null default '',
 focus_area text not null check (focus_area in ('Reading','Mathematics','Science')),
 target_skill text not null check (char_length(target_skill) between 1 and 500),
 assessment_basis text not null check (char_length(assessment_basis) between 1 and 5000),
 learner_instructions text not null default '' check (char_length(learner_instructions)<=8000),
 resource_url text not null default '' check (resource_url='' or resource_url ~ '^https://'),
 status text not null default 'active' check (status in ('active','paused','completed','archived')),
 created_by uuid not null default auth.uid() references public.profiles(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check (student_id<>tutor_id)
);
create index aral_plans_student_year on public.aral_support_plans(student_id,school_year_id);
create index aral_plans_tutor_year on public.aral_support_plans(tutor_id,school_year_id);
create index aral_plans_created_by on public.aral_support_plans(created_by);
create index aral_plans_year_status on public.aral_support_plans(school_year_id,status);

create table public.aral_support_sessions (
 id uuid primary key default gen_random_uuid(),
 plan_id uuid not null references public.aral_support_plans(id),
 session_date date not null,
 activity text not null check (char_length(activity) between 1 and 10000),
 attendance text not null default 'scheduled' check (attendance in ('scheduled','present','absent','excused')),
 assessment_name text not null default '' check (char_length(assessment_name)<=180),
 score numeric(8,2),
 max_score numeric(8,2),
 feedback text not null default '' check (char_length(feedback)<=8000),
 next_steps text not null default '' check (char_length(next_steps)<=5000),
 resource_url text not null default '' check (resource_url='' or resource_url ~ '^https://'),
 created_by uuid not null default auth.uid() references public.profiles(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check ((score is null and max_score is null) or
   (score is not null and max_score is not null and score>=0 and max_score>0
    and max_score<=100000 and score<=max_score and char_length(assessment_name)>0))
);
create index aral_sessions_plan_date on public.aral_support_sessions(plan_id,session_date);
create index aral_sessions_created_by on public.aral_support_sessions(created_by);

create table public.aral_learner_responses (
 session_id uuid primary key references public.aral_support_sessions(id),
 student_id uuid not null default auth.uid() references public.profiles(id),
 message text not null default '' check (char_length(message)<=5000),
 completed boolean not null default false,
 needs_help boolean not null default false,
 updated_at timestamptz not null default now()
);
create index aral_responses_student on public.aral_learner_responses(student_id);

create function private.touch_learning_updated_at() returns trigger
 language plpgsql security invoker set search_path='' as $$
begin new.updated_at=statement_timestamp(); return new; end;
$$;
revoke all on function private.touch_learning_updated_at() from public,anon,authenticated;

create function private.validate_aral_support_assignment() returns trigger
 language plpgsql security invoker set search_path='' as $$
declare enrollment record; learner_name text; assigned_tutor_name text;
begin
 if TG_OP='UPDATE' and new.student_id=old.student_id and new.tutor_id=old.tutor_id
    and new.school_year_id=old.school_year_id then return new; end if;
 select e.grade_level,e.section_id,s.name into enrollment
 from public.student_enrollments e join public.sections s on s.id=e.section_id
 join public.school_years y on y.id=e.school_year_id
 where e.student_id=new.student_id and e.school_year_id=new.school_year_id
   and e.enrollment_status='active' and e.learner_status='active'
   and e.grade_level between 7 and 10 and y.is_active limit 1;
 if not found then raise exception 'Select an active Junior High School learner in the current school year'; end if;
 select full_name into learner_name from public.profiles
 where id=new.student_id and role='student' and account_status='active';
 if not found then raise exception 'Learner account is not active'; end if;
 select full_name into assigned_tutor_name from public.profiles
 where id=new.tutor_id and role='teacher' and account_status='active';
 if not found then raise exception 'Choose an active teacher as tutor'; end if;
 if exists(select 1 from public.teacher_assignments a
   where a.school_year_id=new.school_year_id and a.section_id=enrollment.section_id
   and a.is_active and (a.teacher_id=new.tutor_id or new.tutor_id=any(a.co_teacher_ids)))
 or exists(select 1 from public.section_advisers a
   where a.school_year_id=new.school_year_id and a.section_id=enrollment.section_id
   and a.is_active and a.teacher_id=new.tutor_id)
 then raise exception 'Choose a tutor who does not currently teach or advise this learner'; end if;
 new.student_name=learner_name; new.tutor_name=assigned_tutor_name;
 new.grade_level=enrollment.grade_level; new.section_name=enrollment.name;
 return new;
end;
$$;
revoke all on function private.validate_aral_support_assignment() from public,anon,authenticated;

create trigger ilaw_touch before update on public.ilaw_lesson_plans
 for each row execute function private.touch_learning_updated_at();
create trigger aral_plan_validate before insert or update on public.aral_support_plans
 for each row execute function private.validate_aral_support_assignment();
create trigger aral_plan_touch before update on public.aral_support_plans
 for each row execute function private.touch_learning_updated_at();
create trigger aral_session_touch before update on public.aral_support_sessions
 for each row execute function private.touch_learning_updated_at();
create trigger aral_response_touch before update on public.aral_learner_responses
 for each row execute function private.touch_learning_updated_at();

alter table public.ilaw_lesson_plans enable row level security;
alter table public.aral_support_plans enable row level security;
alter table public.aral_support_sessions enable row level security;
alter table public.aral_learner_responses enable row level security;
revoke all on public.ilaw_lesson_plans,public.aral_support_plans,public.aral_support_sessions,public.aral_learner_responses from public,anon,authenticated;
grant select,insert,update on public.ilaw_lesson_plans,public.aral_support_plans,public.aral_support_sessions,public.aral_learner_responses to authenticated;

create policy "ILAW owners and school administrators read plans" on public.ilaw_lesson_plans for select to authenticated
 using (exists(select 1 from public.profiles p where p.id=(select auth.uid())
   and p.account_status='active' and not p.must_change_password and p.role in ('teacher','administrator')
   and (ilaw_lesson_plans.owner_id=p.id or p.role='administrator')));
create policy "ILAW staff create their own plans" on public.ilaw_lesson_plans for insert to authenticated
 with check (owner_id=(select auth.uid()) and exists(select 1 from public.profiles p
   where p.id=(select auth.uid()) and p.account_status='active' and not p.must_change_password
   and p.role in ('teacher','administrator')));
create policy "ILAW owners and administrators update plans" on public.ilaw_lesson_plans for update to authenticated
 using (exists(select 1 from public.profiles p where p.id=(select auth.uid())
   and p.account_status='active' and not p.must_change_password and p.role in ('teacher','administrator')
   and (ilaw_lesson_plans.owner_id=p.id or p.role='administrator')))
 with check (exists(select 1 from public.profiles p where p.id=(select auth.uid())
   and p.account_status='active' and not p.must_change_password and p.role in ('teacher','administrator')
   and (ilaw_lesson_plans.owner_id=p.id or p.role='administrator')));

create policy "ARAL learner tutor administrator read plans" on public.aral_support_plans for select to authenticated
 using (exists(select 1 from public.profiles p where p.id=(select auth.uid())
   and p.account_status='active' and not p.must_change_password
   and ((p.role='student' and aral_support_plans.student_id=p.id)
     or (p.role='teacher' and aral_support_plans.tutor_id=p.id) or p.role='administrator')));
create policy "School administrators create ARAL assignments" on public.aral_support_plans for insert to authenticated
 with check (created_by=(select auth.uid()) and exists(select 1 from public.profiles p
   where p.id=(select auth.uid()) and p.role='administrator' and p.account_status='active' and not p.must_change_password));
create policy "School administrators update ARAL assignments" on public.aral_support_plans for update to authenticated
 using (exists(select 1 from public.profiles p where p.id=(select auth.uid())
   and p.role='administrator' and p.account_status='active' and not p.must_change_password))
 with check (exists(select 1 from public.profiles p where p.id=(select auth.uid())
   and p.role='administrator' and p.account_status='active' and not p.must_change_password));

create policy "ARAL participants read their sessions" on public.aral_support_sessions for select to authenticated
 using (exists(select 1 from public.aral_support_plans p where p.id=aral_support_sessions.plan_id));
create policy "ARAL assigned tutors and administrators create sessions" on public.aral_support_sessions for insert to authenticated
 with check (created_by=(select auth.uid()) and exists(select 1 from public.aral_support_plans p
   join public.profiles me on me.id=(select auth.uid()) where p.id=aral_support_sessions.plan_id
   and p.status='active' and me.account_status='active' and not me.must_change_password
   and ((me.role='teacher' and p.tutor_id=me.id) or me.role='administrator')));
create policy "ARAL tutors and administrators update sessions" on public.aral_support_sessions for update to authenticated
 using (exists(select 1 from public.aral_support_plans p join public.profiles me on me.id=(select auth.uid())
   where p.id=aral_support_sessions.plan_id and p.status='active' and me.account_status='active' and not me.must_change_password
   and ((me.role='teacher' and p.tutor_id=me.id) or me.role='administrator')))
 with check (exists(select 1 from public.aral_support_plans p join public.profiles me on me.id=(select auth.uid())
   where p.id=aral_support_sessions.plan_id and p.status='active' and me.account_status='active' and not me.must_change_password
   and ((me.role='teacher' and p.tutor_id=me.id) or me.role='administrator')));

create policy "ARAL participants read learner responses" on public.aral_learner_responses for select to authenticated
 using (exists(select 1 from public.aral_support_sessions s join public.aral_support_plans p on p.id=s.plan_id
   where s.id=aral_learner_responses.session_id and p.student_id=aral_learner_responses.student_id));
create policy "ARAL learners submit only their own response" on public.aral_learner_responses for insert to authenticated
 with check (student_id=(select auth.uid()) and exists(select 1 from public.aral_support_sessions s
   join public.aral_support_plans p on p.id=s.plan_id where s.id=aral_learner_responses.session_id
   and p.student_id=(select auth.uid()) and p.status='active'));
create policy "ARAL learners update only their own response" on public.aral_learner_responses for update to authenticated
 using (student_id=(select auth.uid()) and exists(select 1 from public.aral_support_sessions s
   join public.aral_support_plans p on p.id=s.plan_id where s.id=aral_learner_responses.session_id
   and p.student_id=(select auth.uid()) and p.status='active'))
 with check (student_id=(select auth.uid()) and exists(select 1 from public.aral_support_sessions s
   join public.aral_support_plans p on p.id=s.plan_id where s.id=aral_learner_responses.session_id
   and p.student_id=(select auth.uid()) and p.status='active'));

