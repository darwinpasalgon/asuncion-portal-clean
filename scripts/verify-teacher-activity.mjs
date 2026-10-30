// Isolated Postgres verification. Supply an installed @electric-sql/pglite module path.
import { pathToFileURL } from "node:url";
import fs from "node:fs";
import assert from "node:assert/strict";
const { PGlite } = await import(pathToFileURL(process.argv[2]).href);
const db = new PGlite();
await db.exec(`
create schema private; create schema auth;
create role anon; create role authenticated;
grant usage on schema public,auth to authenticated,anon;
create function auth.uid() returns uuid language sql stable as $$
 select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid;
$$;
create table auth.users(id uuid primary key,last_sign_in_at timestamptz,deleted_at timestamptz);
create table public.profiles(id uuid primary key,full_name text,email text,position text,role text,admin_role text,account_status text);
`);
const migration = fs.readdirSync(new URL("../supabase/migrations/",import.meta.url)).find(n => n.endsWith("_teacher_portal_activity.sql"));
await db.exec(fs.readFileSync(new URL("../supabase/migrations/"+migration,import.meta.url),"utf8"));
const id = n => "00000000-0000-0000-0000-"+String(n).padStart(12,"0");
for (const [n,role,admin,status] of [[1,"administrator","super_administrator","active"],[2,"teacher",null,"active"],[3,"student",null,"active"],[4,"teacher",null,"inactive"],[5,"teacher",null,"active"]]) {
  await db.query("insert into auth.users(id,last_sign_in_at) values($1,$2)",[id(n),n===2?"2026-10-01T00:00:00Z":null]);
  await db.query("insert into public.profiles values($1,$2,'fixture@example.com','Teacher I',$3,$4,$5)",[id(n),"Fixture "+n,role,admin,status]);
}
async function asUser(n,sql) {
  await db.exec("set role authenticated");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[n?id(n):""]);
  try { return await db.query(sql); } finally { await db.exec("reset role"); }
}
let checks=0;
for(const n of [null,2,3,4]) { await assert.rejects(asUser(n,"select public.teacher_portal_activity_report()"));checks++; }
await db.exec("set role anon");
await assert.rejects(db.query("select public.teacher_portal_activity_report()"));checks++;
await assert.rejects(db.query("select public.record_teacher_portal_activity()"));checks++;
await db.exec("reset role");
await assert.rejects(asUser(2,"select * from private.teacher_portal_activity_days"));checks++;
await assert.rejects(asUser(2,"insert into private.teacher_portal_activity_days values('"+id(5)+"',current_date,now(),now())"));checks++;
await asUser(2,"select public.record_teacher_portal_activity()");
await asUser(2,"select public.record_teacher_portal_activity()");
let rows=(await db.query("select * from private.teacher_portal_activity_days")).rows;
assert.equal(rows.length,1);assert.equal(rows[0].user_id,id(2));assert.equal(rows[0].first_seen_at.getTime(),rows[0].last_seen_at.getTime());checks++;
await asUser(3,"select public.record_teacher_portal_activity()");
await asUser(4,"select public.record_teacher_portal_activity()");
assert.equal((await db.query("select count(*)::int as n from private.teacher_portal_activity_days")).rows[0].n,1);checks++;
await db.query("insert into private.teacher_portal_activity_days select $1,(now() at time zone 'Asia/Manila')::date-d,now()-make_interval(days=>d),now()-make_interval(days=>d) from unnest(array[6,29,30]) d",[id(2)]);
const report=(await asUser(1,"select public.teacher_portal_activity_report() as data")).rows[0].data;
assert.equal(report.teachers.length,2);checks++;
const teacher=report.teachers.find(r=>r.id===id(2));
assert.equal(teacher.active_days_30,3);assert.equal(teacher.active_days_7,2);checks++;
const never=report.teachers.find(r=>r.id===id(5));assert.equal(never.last_sign_in_at,null);assert.equal(never.last_seen_at,null);checks++;
assert.ok(report.tracking_started_at);assert.ok(report.generated_at);checks++;
assert.deepEqual(Object.keys(teacher).sort(),["active_days_30","active_days_7","email","full_name","id","last_seen_at","last_sign_in_at","position"]);checks++;
await db.query("update public.profiles set account_status='inactive' where id=$1",[id(1)]);
await assert.rejects(asUser(1,"select public.teacher_portal_activity_report()"));checks++;
console.log("Passed "+checks+" isolated activity checks: roles, direct-table denial, deduplication, Manila date windows, never-login data and revoked admin access.");
await db.close();
