-- Transactional authorization and counting probe. All fixture writes roll back.
begin;
create temporary table visitor_fixture(role text primary key,user_id uuid not null) on commit drop;
insert into visitor_fixture(role,user_id)
select distinct on(p.role) p.role::text,p.id
from public.profiles p join auth.users u on u.id=p.id
where p.account_status='active' and not coalesce(p.must_change_password,false)
  and u.deleted_at is null and (u.banned_until is null or u.banned_until<=now())
order by p.role,p.id;
grant select on visitor_fixture to authenticated;
do $test$ begin
  if (select count(*) from visitor_fixture)<>4 then raise exception 'Four eligible account types required'; end if;
end; $test$;
delete from private.portal_visit_days where user_id in(select user_id from visitor_fixture);
set local role authenticated;
select set_config('request.jwt.claim.sub',(select user_id::text from pg_temp.visitor_fixture where role='teacher'),true);
insert into public.community_presence(user_id,last_seen) values(auth.uid(),'2099-01-01T00:00:00Z')
on conflict(user_id) do update set last_seen=excluded.last_seen;
insert into public.community_presence(user_id) values(auth.uid())
on conflict(user_id) do update set last_seen=excluded.last_seen;
select set_config('request.jwt.claim.sub',(select user_id::text from pg_temp.visitor_fixture where role='student'),true);
insert into public.community_presence(user_id,last_seen) values(auth.uid(),'2099-01-01T00:00:00Z')
on conflict(user_id) do update set last_seen=excluded.last_seen;
insert into public.community_presence(user_id) values(auth.uid())
on conflict(user_id) do update set last_seen=excluded.last_seen;
select set_config('request.jwt.claim.sub',(select user_id::text from pg_temp.visitor_fixture where role='administrator'),true);
insert into public.community_presence(user_id,last_seen) values(auth.uid(),'2099-01-01T00:00:00Z')
on conflict(user_id) do update set last_seen=excluded.last_seen;
insert into public.community_presence(user_id) values(auth.uid())
on conflict(user_id) do update set last_seen=excluded.last_seen;
select set_config('request.jwt.claim.sub',(select user_id::text from pg_temp.visitor_fixture where role='staff_administrator'),true);
insert into public.community_presence(user_id,last_seen) values(auth.uid(),'2099-01-01T00:00:00Z')
on conflict(user_id) do update set last_seen=excluded.last_seen;
insert into public.community_presence(user_id) values(auth.uid())
on conflict(user_id) do update set last_seen=excluded.last_seen;
do $test$ begin
  begin
    perform count(*) from private.portal_visit_days;
    raise exception 'Raw activity access allowed';
  exception when insufficient_privilege then null;
  end;
  begin
    perform count(*) from private.portal_visit_config;
    raise exception 'Raw configuration access allowed';
  exception when insufficient_privilege then null;
  end;
end; $test$;
select set_config('request.jwt.claim.sub',(select user_id::text from pg_temp.visitor_fixture where role='student'),true);
do $test$ begin
  begin
    insert into public.community_presence(user_id)
    select user_id from pg_temp.visitor_fixture where role='teacher';
    raise exception 'Forged presence was allowed';
  exception
    when insufficient_privilege then null;
    when raise_exception then if sqlerrm<>'invalid community presence user' then raise; end if;
  end;
end; $test$;
reset role;
do $test$ begin
  if (select count(*) from private.portal_visit_days where user_id in(select user_id from visitor_fixture))<>4 then raise exception 'Repeated visits were not deduplicated'; end if;
  if exists(select 1 from private.portal_visit_days where user_id in(select user_id from visitor_fixture) and activity_date<>(now() at time zone 'Asia/Manila')::date) then raise exception 'Client timestamp affected the visit day'; end if;
end; $test$;

-- Make the isolated fixture cover the thirty-day boundary.
update private.portal_visit_config set tracking_started_at=now()-interval '60 days' where singleton;
insert into private.portal_visit_days(user_id,activity_date)
select f.user_id,(now() at time zone 'Asia/Manila')::date-g.n
from visitor_fixture f cross join lateral generate_series(1,case f.role when 'teacher' then 14 when 'student' then 10 when 'administrator' then 8 else 6 end) g(n)
on conflict do nothing;
insert into private.portal_visit_days(user_id,activity_date)
select user_id,(now() at time zone 'Asia/Manila')::date+g.n
from visitor_fixture cross join (values(-30),(1)) g(n) where role='teacher'
on conflict do nothing;
insert into private.portal_visit_days(user_id,activity_date)
select p.id,(now() at time zone 'Asia/Manila')::date-g.n
from (
  select p.id from public.profiles p join auth.users u on u.id=p.id
  where p.account_status='active' and not coalesce(p.must_change_password,false)
    and p.id not in(select user_id from visitor_fixture) and u.deleted_at is null
    and (u.banned_until is null or u.banned_until<=now())
  order by p.id limit 12
) p cross join generate_series(0,1) g(n)
on conflict do nothing;
set local role authenticated;
select set_config('request.jwt.claim.sub',(select user_id::text from pg_temp.visitor_fixture where role='teacher'),true);
do $test$
declare r jsonb; item jsonb; ordinal bigint;
begin
  r:=public.portal_top_visitors();
  if jsonb_array_length(r->'visitors')<>10 then raise exception 'Expected exactly ten visitors'; end if;
  if (r->'visitors'->0->>'visit_days')::integer<>15 then raise exception 'Window or ranking incorrect'; end if;
  if not exists(select 1 from jsonb_array_elements(r->'visitors') v where (v->>'is_you')::boolean) then raise exception 'Missing own-account marker for teacher'; end if;
  for item,ordinal in select value,ordinality from jsonb_array_elements(r->'visitors') with ordinality loop
    if (item->>'rank')::bigint<>ordinal then raise exception 'Invalid ranks'; end if;
    if (select count(*) from jsonb_object_keys(item))<>4 or item ?| array['id','email','lrn','last_seen_at','role'] then raise exception 'Private account data leaked'; end if;
  end loop;
end;
$test$;
select set_config('request.jwt.claim.sub',(select user_id::text from pg_temp.visitor_fixture where role='student'),true);
do $test$
declare r jsonb; item jsonb; ordinal bigint;
begin
  r:=public.portal_top_visitors();
  if jsonb_array_length(r->'visitors')<>10 then raise exception 'Expected exactly ten visitors'; end if;
  if (r->'visitors'->0->>'visit_days')::integer<>15 then raise exception 'Window or ranking incorrect'; end if;
  if not exists(select 1 from jsonb_array_elements(r->'visitors') v where (v->>'is_you')::boolean) then raise exception 'Missing own-account marker for student'; end if;
  for item,ordinal in select value,ordinality from jsonb_array_elements(r->'visitors') with ordinality loop
    if (item->>'rank')::bigint<>ordinal then raise exception 'Invalid ranks'; end if;
    if (select count(*) from jsonb_object_keys(item))<>4 or item ?| array['id','email','lrn','last_seen_at','role'] then raise exception 'Private account data leaked'; end if;
  end loop;
end;
$test$;
select set_config('request.jwt.claim.sub',(select user_id::text from pg_temp.visitor_fixture where role='administrator'),true);
do $test$
declare r jsonb; item jsonb; ordinal bigint;
begin
  r:=public.portal_top_visitors();
  if jsonb_array_length(r->'visitors')<>10 then raise exception 'Expected exactly ten visitors'; end if;
  if (r->'visitors'->0->>'visit_days')::integer<>15 then raise exception 'Window or ranking incorrect'; end if;
  if not exists(select 1 from jsonb_array_elements(r->'visitors') v where (v->>'is_you')::boolean) then raise exception 'Missing own-account marker for administrator'; end if;
  for item,ordinal in select value,ordinality from jsonb_array_elements(r->'visitors') with ordinality loop
    if (item->>'rank')::bigint<>ordinal then raise exception 'Invalid ranks'; end if;
    if (select count(*) from jsonb_object_keys(item))<>4 or item ?| array['id','email','lrn','last_seen_at','role'] then raise exception 'Private account data leaked'; end if;
  end loop;
end;
$test$;
select set_config('request.jwt.claim.sub',(select user_id::text from pg_temp.visitor_fixture where role='staff_administrator'),true);
do $test$
declare r jsonb; item jsonb; ordinal bigint;
begin
  r:=public.portal_top_visitors();
  if jsonb_array_length(r->'visitors')<>10 then raise exception 'Expected exactly ten visitors'; end if;
  if (r->'visitors'->0->>'visit_days')::integer<>15 then raise exception 'Window or ranking incorrect'; end if;
  if not exists(select 1 from jsonb_array_elements(r->'visitors') v where (v->>'is_you')::boolean) then raise exception 'Missing own-account marker for staff_administrator'; end if;
  for item,ordinal in select value,ordinality from jsonb_array_elements(r->'visitors') with ordinality loop
    if (item->>'rank')::bigint<>ordinal then raise exception 'Invalid ranks'; end if;
    if (select count(*) from jsonb_object_keys(item))<>4 or item ?| array['id','email','lrn','last_seen_at','role'] then raise exception 'Private account data leaked'; end if;
  end loop;
end;
$test$;
reset role;

-- Forced-password-change users neither enter the ranking nor read it.
delete from private.portal_visit_days where user_id=(select user_id from visitor_fixture where role='student')
  and activity_date=(now() at time zone 'Asia/Manila')::date;
update public.profiles set must_change_password=true where id=(select user_id from visitor_fixture where role='student');
set local role authenticated;
select set_config('request.jwt.claim.sub',(select user_id::text from pg_temp.visitor_fixture where role='student'),true);
insert into public.community_presence(user_id) values(auth.uid())
on conflict(user_id) do update set last_seen=excluded.last_seen;
do $test$ begin
  begin perform public.portal_top_visitors();raise exception 'First-login report access allowed';
  exception when insufficient_privilege then null; end;
end; $test$;
reset role;
do $test$ begin
  if exists(select 1 from private.portal_visit_days where user_id=(select user_id from visitor_fixture where role='student') and activity_date=(now() at time zone 'Asia/Manila')::date) then raise exception 'First-login visit recorded'; end if;
end; $test$;
update public.profiles set must_change_password=false where id=(select user_id from visitor_fixture where role='student');

-- Account status and server-side bans remain authoritative.
update public.profiles set account_status='pending' where id=(select user_id from visitor_fixture where role='teacher');
set local role authenticated;
select set_config('request.jwt.claim.sub',(select user_id::text from pg_temp.visitor_fixture where role='teacher'),true);
do $test$ begin
  begin perform public.portal_top_visitors();raise exception 'Inactive report access allowed';
  exception when insufficient_privilege then null; end;
end; $test$;
reset role;
update auth.users set banned_until=now()+interval '1 day' where id=(select user_id from visitor_fixture where role='administrator');
set local role authenticated;
select set_config('request.jwt.claim.sub',(select user_id::text from pg_temp.visitor_fixture where role='administrator'),true);
do $test$ begin
  begin perform public.portal_top_visitors();raise exception 'Banned report access allowed';
  exception when insufficient_privilege then null; end;
end; $test$;
reset role;
set local role anon;
select set_config('request.jwt.claim.sub','',true);
do $test$ begin
  begin perform public.portal_top_visitors();raise exception 'Anonymous report access allowed';
  exception when insufficient_privilege then null; end;
end; $test$;
reset role;
select 'PASS: four roles; one visit per Manila day; client timestamps ignored; top ten; bounded private response; first-login, inactive, banned and anonymous users blocked' as result;
rollback;

