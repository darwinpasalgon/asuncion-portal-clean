-- Super administrators can view the leaderboard but do not enter its ranking.
create or replace function private.portal_top_visitors()
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
      and p.admin_role is distinct from 'super_administrator'
      and nullif(btrim(p.full_name),'') is not null
      and u.deleted_at is null and (u.banned_until is null or u.banned_until<=now())
    order by t.visit_days desc,lower(btrim(p.full_name)),btrim(p.full_name),p.id
    limit 20
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


