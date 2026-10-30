const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, extras = {}) {
  const mod = {exports:{}};
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname,'..',file),'utf8'), {
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
  }).outputText;
  class NextResponse extends Response { static json(body, options) { return Response.json(body, options); } }
  vm.runInNewContext(code, {module:mod,exports:mod.exports,URL,
    require(name) {
      if(name==='next/server') return {NextResponse};
      if(name==='@/lib/admin-access') return {isSuperAdministrator:async()=>extras.allowed??true};
      if(name==='@/lib/supabase-config') return {SUPABASE_URL:'https://fixture.example',SUPABASE_PUBLISHABLE_KEY:'public'};
      throw Error(name);
    }, ...extras});
  return mod.exports;
}
const row={last_sign_in_at:null,last_seen_at:null,active_days_30:0,active_days_7:0};
test('activity labels distinguish never opened, occasional, stale and repeat recent visits',()=>{
  const {activityStatus}=load('lib/teacher-activity.ts');
  assert.equal(activityStatus(row),'never');
  assert.equal(activityStatus({...row,last_sign_in_at:'2026-01-01'}),'opened');
  assert.equal(activityStatus({...row,last_seen_at:'2026-10-30',active_days_30:2,active_days_7:2}),'opened');
  assert.equal(activityStatus({...row,last_seen_at:'2026-10-30',active_days_30:3,active_days_7:1}),'active');
  assert.equal(activityStatus({...row,last_seen_at:'2026-10-01',active_days_30:10,active_days_7:0}),'opened');
});
function request({token='fixture',origin='https://portal.example',site='same-origin'}={}) {
  return {cookies:{get:()=>token?{value:token}:undefined},headers:new Headers({origin,'sec-fetch-site':site}),nextUrl:new URL('https://portal.example/api/teacher-activity')};
}
test('activity report rejects unsigned and non-super-admin requests before reading data',async()=>{
  for(const [allowed,token] of [[true,''],[false,'fixture']]) {
    const api=load('app/api/admin/teacher-activity/route.ts',{allowed,fetch:async()=>{throw Error('must not fetch')}});
    assert.equal((await api.GET(request({token}))).status,403);
  }
});
test('report is private and forwards only an authenticated empty RPC request',async()=>{
  const api=load('app/api/admin/teacher-activity/route.ts',{fetch:async(url,init)=>{
    assert.match(url,/rpc\/teacher_portal_activity_report$/);
    assert.equal(init.headers.Authorization,'Bearer fixture'); assert.equal(init.body,'{}'); assert.equal(init.cache,'no-store');
    return Response.json({teachers:[]});
  }});
  const response=await api.GET(request()); assert.equal(response.status,200);
  assert.match(response.headers.get('cache-control'),/private, no-store/);
});
test('report fails clearly when the database is unavailable',async()=>{
  const api=load('app/api/admin/teacher-activity/route.ts',{fetch:async()=>new Response('unavailable',{status:500})});
  assert.equal((await api.GET(request())).status,502);
});
test('tracking rejects unsigned or cross-site requests and never accepts a client-selected identity or timestamp',async()=>{
  let calls=0;
  const api=load('app/api/teacher-activity/route.ts',{fetch:async(url,init)=>{
    calls++;assert.match(url,/record_teacher_portal_activity$/);assert.equal(init.body,'{}');return Response.json(null);
  }});
  assert.equal((await api.POST(request({token:''}))).status,401);
  assert.equal((await api.POST(request({origin:'https://attacker.example'}))).status,403);
  assert.equal((await api.POST(request({site:'cross-site'}))).status,403);
  assert.equal(calls,0);
  assert.equal((await api.POST(request())).status,200);assert.equal(calls,1);
});
