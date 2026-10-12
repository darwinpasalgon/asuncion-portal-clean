alter table public.community_messages
  add column if not exists room_type text not null default 'school',
  add column if not exists grade_level smallint,
  add column if not exists section_id uuid references public.sections(id) on delete restrict;

alter table public.community_messages
  drop constraint if exists community_messages_room_scope_check;

alter table public.community_messages
  add constraint community_messages_room_scope_check
  check (
    (room_type = 'school' and grade_level is null and section_id is null)
    or
    (
      room_type = 'grade'
      and grade_level in (0,7,8,9,10,11,12)
      and section_id is null
    )
    or
    (
      room_type = 'section'
      and grade_level in (0,7,8,9,10,11,12)
      and section_id is not null
    )
  );

create index if not exists community_messages_room_created_idx
  on public.community_messages(room_type, grade_level, section_id, created_at desc);

alter table public.community_reports
  add column if not exists room_type text not null default 'school',
  add column if not exists grade_level smallint,
  add column if not exists section_id uuid references public.sections(id) on delete set null;

alter table public.community_reports
  drop constraint if exists community_reports_room_scope_check;

alter table public.community_reports
  add constraint community_reports_room_scope_check
  check (
    (room_type = 'school' and grade_level is null and section_id is null)
    or
    (
      room_type = 'grade'
      and grade_level in (0,7,8,9,10,11,12)
      and section_id is null
    )
    or
    (
      room_type = 'section'
      and grade_level in (0,7,8,9,10,11,12)
      and section_id is not null
    )
  );

create table if not exists public.community_room_read_state (
  user_id uuid not null references public.profiles(id) on delete cascade,
  room_type text not null,
  grade_level smallint,
  section_id uuid references public.sections(id) on delete cascade,
  room_key text generated always as (
    case
      when room_type = 'school' then 'school'
      when room_type = 'grade' then 'grade:' || grade_level::text
      when room_type = 'section' then 'section:' || section_id::text
      else 'invalid'
    end
  ) stored,
  last_read_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, room_key),
  constraint community_room_read_state_scope_check check (
    (room_type = 'school' and grade_level is null and section_id is null)
    or
    (
      room_type = 'grade'
      and grade_level in (0,7,8,9,10,11,12)
      and section_id is null
    )
    or
    (
      room_type = 'section'
      and grade_level in (0,7,8,9,10,11,12)
      and section_id is not null
    )
  )
);

alter table public.community_room_read_state enable row level security;

insert into public.community_room_read_state (
  user_id,
  room_type,
  grade_level,
  section_id,
  last_read_at,
  updated_at
)
select
  user_id,
  'school',
  null,
  null,
  last_read_at,
  updated_at
from public.community_read_state
on conflict (user_id, room_key) do nothing;

create or replace function private.community_room_access(
  p_user_id uuid,
  p_room_type text,
  p_grade_level smallint,
  p_section_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_role text;
  v_school_year_id uuid;
  v_section_grade smallint;
begin
  select p.role
    into v_role
  from public.profiles p
  where p.id = p_user_id
    and p.account_status = 'active'
    and p.role is not null;

  if v_role is null then
    return false;
  end if;

  if p_room_type = 'school' then
    return p_grade_level is null and p_section_id is null;
  end if;

  if p_room_type = 'grade' then
    if p_grade_level not in (0,7,8,9,10,11,12) or p_section_id is not null then
      return false;
    end if;
  elsif p_room_type = 'section' then
    if p_section_id is null then
      return false;
    end if;

    select s.grade_level
      into v_section_grade
    from public.sections s
    where s.id = p_section_id
      and s.is_active = true;

    if v_section_grade is null
       or p_grade_level is distinct from v_section_grade then
      return false;
    end if;
  else
    return false;
  end if;

  if v_role = 'administrator' then
    return true;
  end if;

  select sy.id
    into v_school_year_id
  from public.school_years sy
  where sy.is_active = true
  order by sy.start_year desc
  limit 1;

  if v_school_year_id is null then
    return false;
  end if;

  if v_role = 'student' then
    if p_room_type = 'grade' then
      return exists (
        select 1
        from public.student_enrollments se
        where se.student_id = p_user_id
          and se.school_year_id = v_school_year_id
          and se.enrollment_status = 'active'
          and se.grade_level = p_grade_level
      );
    end if;

    return exists (
      select 1
      from public.student_enrollments se
      where se.student_id = p_user_id
        and se.school_year_id = v_school_year_id
        and se.enrollment_status = 'active'
        and se.grade_level = p_grade_level
        and se.section_id = p_section_id
    );
  end if;

  if v_role = 'teacher' then
    if p_room_type = 'grade' then
      return
        exists (
          select 1
          from public.teacher_assignments ta
          where ta.school_year_id = v_school_year_id
            and ta.is_active = true
            and ta.grade_level = p_grade_level
            and (
              ta.teacher_id = p_user_id
              or p_user_id = any(ta.co_teacher_ids)
            )
        )
        or exists (
          select 1
          from public.section_advisers sa
          join public.sections s on s.id = sa.section_id
          where sa.school_year_id = v_school_year_id
            and sa.is_active = true
            and sa.teacher_id = p_user_id
            and s.grade_level = p_grade_level
        )
        or exists (
          select 1
          from public.grade_level_heads glh
          where glh.profile_id = p_user_id
            and glh.grade_level = p_grade_level
        );
    end if;

    return
      exists (
        select 1
        from public.teacher_assignments ta
        where ta.school_year_id = v_school_year_id
          and ta.is_active = true
          and ta.section_id = p_section_id
          and ta.grade_level = p_grade_level
          and (
            ta.teacher_id = p_user_id
            or p_user_id = any(ta.co_teacher_ids)
          )
      )
      or exists (
        select 1
        from public.section_advisers sa
        where sa.school_year_id = v_school_year_id
          and sa.is_active = true
          and sa.teacher_id = p_user_id
          and sa.section_id = p_section_id
      )
      or exists (
        select 1
        from public.grade_level_heads glh
        where glh.profile_id = p_user_id
          and glh.grade_level = p_grade_level
      );
  end if;

  return false;
end;
$function$;

create or replace function private.prepare_community_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_profile public.profiles%rowtype;
  v_section_grade smallint;
begin
  if (select auth.uid()) is null or new.user_id <> (select auth.uid()) then
    raise exception 'invalid community message user';
  end if;

  select * into v_profile
  from public.profiles
  where id=(select auth.uid())
    and account_status='active'
    and role is not null;

  if v_profile.id is null then
    raise exception 'active portal account required';
  end if;

  new.room_type := lower(trim(coalesce(new.room_type, 'school')));

  if new.room_type = 'school' then
    new.grade_level := null;
    new.section_id := null;
  elsif new.room_type = 'grade' then
    new.section_id := null;
    if new.grade_level not in (0,7,8,9,10,11,12) then
      raise exception 'invalid community grade room';
    end if;
  elsif new.room_type = 'section' then
    if new.section_id is null then
      raise exception 'community section room required';
    end if;

    select s.grade_level
      into v_section_grade
    from public.sections s
    where s.id = new.section_id
      and s.is_active = true;

    if v_section_grade is null then
      raise exception 'community section room not found';
    end if;

    new.grade_level := v_section_grade;
  else
    raise exception 'invalid community room';
  end if;

  if not private.community_room_access(
    (select auth.uid()),
    new.room_type,
    new.grade_level,
    new.section_id
  ) then
    raise exception 'community room access denied';
  end if;

  if exists (
    select 1
    from public.community_mutes m
    where m.user_id=(select auth.uid())
      and (m.muted_until is null or m.muted_until > now())
  ) then
    raise exception 'community posting is temporarily muted';
  end if;

  if (
    select count(*)
    from public.community_messages cm
    where cm.user_id=(select auth.uid())
      and cm.created_at > now() - interval '1 minute'
  ) >= 20 then
    raise exception 'message rate limit reached';
  end if;

  new.body := trim(new.body);
  if char_length(new.body) < 1 or char_length(new.body) > 1000 then
    raise exception 'message must contain 1 to 1000 characters';
  end if;

  new.sender_name := coalesce(nullif(trim(v_profile.full_name),''),'Portal User');
  new.sender_role := v_profile.role;
  new.created_at := now();
  return new;
end;
$function$;

create or replace function private.prepare_community_report()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_message public.community_messages%rowtype;
  v_reporter public.profiles%rowtype;
begin
  if (select auth.uid()) is null or new.reporter_id <> (select auth.uid()) then
    raise exception 'invalid community report user';
  end if;

  select * into v_reporter
  from public.profiles
  where id=(select auth.uid())
    and account_status='active'
    and role is not null;

  if v_reporter.id is null then
    raise exception 'active portal account required';
  end if;

  select * into v_message
  from public.community_messages
  where id=new.message_id;

  if v_message.id is null
     or not private.community_room_access(
       (select auth.uid()),
       v_message.room_type,
       v_message.grade_level,
       v_message.section_id
     ) then
    raise exception 'community message not found';
  end if;

  if v_message.user_id=(select auth.uid()) then
    raise exception 'you cannot report your own message';
  end if;

  new.reported_user_id := v_message.user_id;
  new.reporter_name := coalesce(nullif(trim(v_reporter.full_name),''),'Portal User');
  new.sender_name := v_message.sender_name;
  new.sender_role := v_message.sender_role;
  new.message_body := v_message.body;
  new.room_type := v_message.room_type;
  new.grade_level := v_message.grade_level;
  new.section_id := v_message.section_id;
  new.reason := trim(new.reason);
  new.status := 'pending';
  new.reviewed_by := null;
  new.reviewed_at := null;
  new.created_at := now();
  return new;
end;
$function$;

drop policy if exists "Active portal users read community messages"
  on public.community_messages;
drop policy if exists "Active portal users send own community messages"
  on public.community_messages;
drop policy if exists "Users or admins delete community messages"
  on public.community_messages;

create policy "Members read accessible community rooms"
on public.community_messages
for select
to authenticated
using (
  private.community_room_access(
    (select auth.uid()),
    room_type,
    grade_level,
    section_id
  )
);

create policy "Members send to accessible community rooms"
on public.community_messages
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and private.community_room_access(
    (select auth.uid()),
    room_type,
    grade_level,
    section_id
  )
);

create policy "Owners or super admin delete community messages"
on public.community_messages
for delete
to authenticated
using (
  (
    user_id = (select auth.uid())
    and private.community_room_access(
      (select auth.uid()),
      room_type,
      grade_level,
      section_id
    )
  )
  or private.is_super_admin()
);

create policy "Users read own room read state"
on public.community_room_read_state
for select
to authenticated
using (user_id = (select auth.uid()));

create policy "Users insert own accessible room read state"
on public.community_room_read_state
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and private.community_room_access(
    (select auth.uid()),
    room_type,
    grade_level,
    section_id
  )
);

create policy "Users update own accessible room read state"
on public.community_room_read_state
for update
to authenticated
using (user_id = (select auth.uid()))
with check (
  user_id = (select auth.uid())
  and private.community_room_access(
    (select auth.uid()),
    room_type,
    grade_level,
    section_id
  )
);

revoke all on public.community_room_read_state from anon;
grant select, insert, update on public.community_room_read_state to authenticated;

create or replace function public.community_room_unread_counts()
returns table (
  room_type text,
  grade_level smallint,
  section_id uuid,
  unread_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $function$
  select
    m.room_type,
    m.grade_level,
    m.section_id,
    count(*)::bigint as unread_count
  from public.community_messages m
  where m.user_id <> (select auth.uid())
    and m.created_at > coalesce(
      (
        select rs.last_read_at
        from public.community_room_read_state rs
        where rs.user_id = (select auth.uid())
          and rs.room_type = m.room_type
          and rs.grade_level is not distinct from m.grade_level
          and rs.section_id is not distinct from m.section_id
        limit 1
      ),
      now()
    )
  group by m.room_type, m.grade_level, m.section_id;
$function$;

revoke all on function public.community_room_unread_counts() from public, anon;
grant execute on function public.community_room_unread_counts() to authenticated;

comment on column public.community_messages.room_type is
  'Community room scope: school, grade, or section.';
comment on table public.community_room_read_state is
  'Per-user read marker for each accessible community chat room.';
comment on function public.community_room_unread_counts() is
  'Returns unread counts only for community messages visible through the caller''s RLS scope.';
