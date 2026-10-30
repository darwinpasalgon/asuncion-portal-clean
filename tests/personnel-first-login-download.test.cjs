const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
function route({ allowed = true } = {}) {
  const calls = [];
  const mod = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname,'..','app/api/admin/personnel-first-login/route.ts'),'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  class NextResponse extends Response { static json(body, options) { return Response.json(body, options); } }
  vm.runInNewContext(code, { module:mod, exports:mod.exports, URL, URLSearchParams,
    require(name) {
      if (name==='next/server') return {NextResponse};
      if (name==='@/lib/admin-access') return {isSuperAdministrator:async()=>allowed};
      if (name==='@/lib/supabase-config') return {SUPABASE_URL:'https://fixture.example',SUPABASE_PUBLISHABLE_KEY:'public'};
      throw Error(name);
    },
    fetch:async(url,options)=>{
      const body=JSON.parse(options.body);calls.push(body);
      return Response.json(body.action==='candidates' ? {count:2,teacher_count:1,staff_count:1} : {
        issued:[{full_name:'Fixture Teacher',email:'teacher@deped.gov.ph',position:'Teacher I',role:'teacher',temporary_password:'Fixture-Only!123'},
          {full_name:'Fixture Staff',email:'staff@deped.gov.ph',position:'Registrar',role:'staff_administrator',temporary_password:'Fixture-Only!456'}],errors:[],
      });
    },
  });
  return {api:mod.exports,calls};
}
function request({token='fixture',origin='https://asuncion-nhs.vercel.app',confirm='ISSUE_FIRST_LOGIN_PASSWORDS'}={}) {
  return {cookies:{get:()=>token?{value:token}:undefined},headers:new Headers({'content-type':'application/x-www-form-urlencoded',origin}),
    nextUrl:new URL('https://asuncion-nhs.vercel.app/api/admin/personnel-first-login'),text:async()=>new URLSearchParams({confirm}).toString()};
}
test('native form download returns teaching and staff credentials as a private CSV attachment',async()=>{
  const {api,calls}=route();const response=await api.POST(request());
  assert.equal(response.status,200);
  assert.match(response.headers.get('content-disposition'),/attachment; filename="ANHS_Personnel_First_Login_Credentials.csv"/);
  assert.match(response.headers.get('cache-control'),/private, no-store/);
  const csv=await response.text();assert.match(csv,/teacher@deped.gov.ph/);assert.match(csv,/staff@deped.gov.ph/);
  assert.match(csv,/Fixture-Only!123/);assert.match(csv,/Change password after first login/);
  assert.equal(calls[0].scope,'all');assert.equal(calls[0].confirm,'ISSUE_FIRST_LOGIN_PASSWORDS');
});
test('missing login, non-super-admin access, missing confirmation and cross-site submissions cannot issue passwords',async()=>{
  for(const [options,req] of [[{},request({token:''})],[{allowed:false},request()],[{},request({confirm:''})],[{},request({origin:'https://other.example'})]]) {
    const {api,calls}=route(options);const response=await api.POST(req);assert.ok([400,403].includes(response.status));assert.equal(calls.length,0);
  }
});
test('eligibility check returns counts without issuing passwords',async()=>{
  const {api,calls}=route();const response=await api.GET(request());const data=await response.json();
  assert.equal(data.count,2);assert.equal(data.staff_count,1);assert.deepEqual(Object.keys(data).sort(),['count','staff_count','teacher_count']);assert.equal(calls[0].action,'candidates');
});
