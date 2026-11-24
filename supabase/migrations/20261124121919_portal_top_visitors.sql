-- Daily visits for the authenticated school community. No browsing history.
-- All account types start together; teacher-only historical data stays separate.
create table private.portal_visit_days (
  user_id uuid not null references auth.users(id) on delete cascade,
  activity_date date not null,
  recorded_at timestamptz not null default now(),
  primary key (user_id, activity_date)
);
create index portal_visit_days_date_idx on private.portal_visit_days(activity_date, user_id);
alter table private.portal_visit_days enable row level security;
create policy portal_visit_days_internal_only on private.portal_visit_days
  for all to authenticated using (false) with check (false);
revoke all on private.portal_visit_days from public, anon, authenticated;

create table private.portal_visit_config (
  singleton boolean primary key default true check (singleton),
  tracking_started_at timestamptz not null default now()
);
alter table private.portal_visit_config enable row level security;
create policy portal_visit_config_internal_only on private.portal_visit_config
  for all to authenticated using (false) with check (false);
revoke all on private.portal_visit_config from public, anon, authenticated;
insert into private.portal_visit_config(singleton) values (true);

create function private.record_portal_visit_from_presence()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  caller uuid := auth.uid();
begin
  if caller is null or new.user_id <> caller then raise insufficient_privilege; end if;
  if not exists (
    select 1 from public.profiles p join auth.users u on u.id=p.id
    where p.id=caller and p.account_status='active'
      and not coalesce(p.must_change_password,false)
      and u.deleted_at is null and (u.banned_until is null or u.banned_until<=now())
  ) then return null; end if;

  insert into private.portal_visit_days(user_id,activity_date)
  values(caller,(now() at time zone 'Asia/Manila')::date)
  on conflict(user_id,activity_date) do nothing;
  return null;
end;
$$;
revoke all on function private.record_portal_visit_from_presence() from public, anon, authenticated;
create trigger portal_visit_record_presence
  after insert or update on public.community_presence
  for each row execute function private.record_portal_visit_from_presence();

-- Seed only confirmed visits today, using the same start day for every role.
insert into private.portal_visit_days(user_id,activity_date,recorded_at)
select c.user_id,(c.last_seen at time zone 'Asia/Manila')::date,c.last_seen
from public.community_presence c
join public.profiles p on p.id=c.user_id
join auth.users u on u.id=c.user_id
where (c.last_seen at time zone 'Asia/Manila')::date=(now() at time zone 'Asia/Manila')::date
  and p.account_status='active' and not coalesce(p.must_change_password,false)
  and u.deleted_at is null and (u.banned_until is null or u.banned_until<=now())
on conflict(user_id,activity_date) do nothing;

create function private.portal_top_visitors()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  caller uuid := auth.uid();
  today date := (now() at time zone 'Asia/Manila')::date;
  started date;
  result jsonb;
begin
  if caller is null or not exists (
    select 1 from public.profiles p join auth.users u on u.id=p.id
    where p.id=caller and p.account_status='active'
      and not coalesce(p.must_change_password,false)
      and u.deleted_at is null and (u.banned_until is null or u.banned_until<=now())
  ) then raise insufficient_privilege using message='An active portal account is required.'; end if;

  select (tracking_started_at at time zone 'Asia/Manila')::date into strict started
  from private.portal_visit_config where singleton;

  with totals as (
    select d.user_id,count(*)::integer as visit_days
    from private.portal_visit_days d
    where d.activity_date between greatest(today-29,started) and today
    group by d.user_id
  ), leaders as (
    select p.id,btrim(p.full_name) as full_name,t.visit_days
    from totals t join public.profiles p on p.id=t.user_id
    join auth.users u on u.id=p.id
    where p.account_status='active' and not coalesce(p.must_change_password,false)
      and nullif(btrim(p.full_name),'') is not null
      and u.deleted_at is null and (u.banned_until is null or u.banned_until<=now())
    order by t.visit_days desc,lower(btrim(p.full_name)),btrim(p.full_name),p.id
    limit 10
  ), ranked as (
    select row_number() over(order by visit_days desc,lower(full_name),full_name,id)::integer as rank,
      full_name,visit_days,(id=caller) as is_you
    from leaders
  )
  select jsonb_build_object(
    'period_start',today-29,'period_end',today,'tracking_started_on',started,
    'visitors',coalesce(jsonb_agg(jsonb_build_object(
      'rank',r.rank,'full_name',r.full_name,'visit_days',r.visit_days,'is_you',r.is_you
    ) order by r.rank),'[]'::jsonb)
  ) into result from ranked r;
  return result;
end;
$$;

create function public.portal_top_visitors()
returns jsonb language sql stable security invoker set search_path = '' as $$
  select private.portal_top_visitors();
$$;
revoke all on function private.portal_top_visitors() from public,anon,authenticated;
revoke all on function public.portal_top_visitors() from public,anon,authenticated;
grant usage on schema private to authenticated;
grant execute on function private.portal_top_visitors() to authenticated;
grant execute on function public.portal_top_visitors() to authenticated;

