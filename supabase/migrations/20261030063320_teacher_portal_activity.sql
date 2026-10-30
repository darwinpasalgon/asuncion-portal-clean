-- Only server-generated visit dates/times. No browsing history or credentials.
create table private.teacher_portal_activity_days (
  user_id uuid not null references auth.users(id) on delete cascade,
  activity_date date not null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  primary key (user_id, activity_date)
);
alter table private.teacher_portal_activity_days enable row level security;
revoke all on private.teacher_portal_activity_days from public, anon, authenticated;

create table private.teacher_portal_activity_config (
  singleton boolean primary key default true check (singleton),
  tracking_started_at timestamptz not null default now()
);
alter table private.teacher_portal_activity_config enable row level security;
revoke all on private.teacher_portal_activity_config from public, anon, authenticated;
insert into private.teacher_portal_activity_config(singleton) values (true);

create function private.record_teacher_portal_activity()
returns void language plpgsql security definer set search_path = '' as $$
declare
  caller uuid := auth.uid();
  visit_time timestamptz := now();
begin
  if caller is null then raise insufficient_privilege; end if;
  if not exists (
    select 1 from public.profiles p where p.id=caller
      and p.role='teacher' and p.account_status='active'
  ) then return; end if;
  insert into private.teacher_portal_activity_days(user_id,activity_date,first_seen_at,last_seen_at)
  values(caller,(visit_time at time zone 'Asia/Manila')::date,visit_time,visit_time)
  on conflict(user_id,activity_date) do update
    set last_seen_at=excluded.last_seen_at
    where private.teacher_portal_activity_days.last_seen_at < visit_time - interval '50 seconds';
end;
$$;

create function private.teacher_portal_activity_report()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  today date := (now() at time zone 'Asia/Manila')::date;
  result jsonb;
begin
  if auth.uid() is null or not exists (
    select 1 from public.profiles p where p.id=auth.uid()
      and p.role='administrator' and p.admin_role='super_administrator' and p.account_status='active'
  ) then raise insufficient_privilege; end if;
  select jsonb_build_object(
    'generated_at',now(),
    'tracking_started_at',(select tracking_started_at from private.teacher_portal_activity_config where singleton),
    'teachers',coalesce(jsonb_agg(jsonb_build_object(
      'id',p.id,'full_name',coalesce(p.full_name,''),'email',coalesce(p.email,''),
      'position',coalesce(p.position,''),'last_sign_in_at',u.last_sign_in_at,
      'last_seen_at',d.last_seen_at,'active_days_30',d.active_days_30,'active_days_7',d.active_days_7
    ) order by p.full_name,p.id),'[]'::jsonb)
  ) into result
  from public.profiles p join auth.users u on u.id=p.id
  cross join lateral (
    select max(a.last_seen_at) as last_seen_at,
      count(*) filter(where a.activity_date between today-29 and today) as active_days_30,
      count(*) filter(where a.activity_date between today-6 and today) as active_days_7
    from private.teacher_portal_activity_days a where a.user_id=p.id
  ) d
  where p.role='teacher' and p.account_status='active' and u.deleted_at is null;
  return result;
end;
$$;

-- Exposed entry points use invoker security; privileged helpers stay private
-- and independently validate the authenticated profile on every invocation.
create function public.record_teacher_portal_activity()
returns void language sql security invoker set search_path = '' as $$
  select private.record_teacher_portal_activity();
$$;
create function public.teacher_portal_activity_report()
returns jsonb language sql stable security invoker set search_path = '' as $$
  select private.teacher_portal_activity_report();
$$;
revoke all on function private.record_teacher_portal_activity() from public,anon,authenticated;
revoke all on function private.teacher_portal_activity_report() from public,anon,authenticated;
revoke all on function public.record_teacher_portal_activity() from public,anon,authenticated;
revoke all on function public.teacher_portal_activity_report() from public,anon,authenticated;
grant usage on schema private to authenticated;
grant execute on function private.record_teacher_portal_activity() to authenticated;
grant execute on function private.teacher_portal_activity_report() to authenticated;
grant execute on function public.record_teacher_portal_activity() to authenticated;
grant execute on function public.teacher_portal_activity_report() to authenticated;
