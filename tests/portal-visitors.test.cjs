const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const lib = import(pathToFileURL(path.join(__dirname, "../lib/portal-visitors.ts")).href);
const config = { url: "https://fixture.example", publishableKey: "public-fixture" };
const report = (count = 2) => ({
  period_start: "2026-10-26", period_end: "2026-11-24", tracking_started_on: "2026-11-24",
  visitors: Array.from({length:count}, (_, i) => ({rank:i+1,full_name:"Portal Member "+(i+1),visit_days:1,is_you:i===0})),
});

test("unsigned requests are rejected before contacting the database", async () => {
  const {portalVisitorsResponse}=await lib;
  const response=await portalVisitorsResponse("",config,async()=>{throw new Error("must not fetch")});
  assert.equal(response.status,401);
});
test("all authenticated roles use the same bounded report without a client-selected identity", async () => {
  const {portalVisitorsResponse}=await lib;
  for (const role of ["student","teacher","administrator","staff_administrator"]) {
    const response=await portalVisitorsResponse(role,config,async (url,init)=>{
      assert.equal(url,"https://fixture.example/rest/v1/rpc/portal_top_visitors");
      assert.equal(init.headers.Authorization,"Bearer "+role);
      assert.equal(init.body,"{}"); assert.equal(init.method,"POST"); assert.equal(init.cache,"no-store");
      return Response.json(report());
    });
    assert.equal(response.status,200);
    assert.match(response.headers.get("cache-control"),/private, no-store/);
    assert.equal(response.headers.get("vary"),"Cookie");
  }
});
test("response exposes only names, ranks, daily totals, and the own-account marker for up to twenty people",async()=>{
  const {portalVisitorsResponse}=await lib;
  const data=report(25);
  data.token="do-not-expose";data.visitors.forEach(row=>Object.assign(row,{id:"private-id",email:"private@example.invalid",lrn:"123456789012",last_seen:"private"}));
  const response=await portalVisitorsResponse("fixture",config,async()=>Response.json(data));
  const result=await response.json();assert.equal(result.visitors.length,20);
  assert.deepEqual(Object.keys(result).sort(),["period_end","period_start","tracking_started_on","visitors"]);
  for (const row of result.visitors) assert.deepEqual(Object.keys(row).sort(),["full_name","is_you","rank","visit_days"]);
  assert.equal(JSON.stringify(result).includes("private"),false);
});
test("inactive, first-login, and expired sessions stay denied",async()=>{
  const {portalVisitorsResponse}=await lib;
  for(const status of [401,403]) {
    const response=await portalVisitorsResponse("fixture",config,async()=>new Response("sensitive database detail",{status}));
    assert.equal(response.status,status);assert.equal((await response.text()).includes("sensitive"),false);
  }
});
test("service and network failures do not masquerade as an empty leaderboard",async()=>{
  const {portalVisitorsResponse}=await lib;
  for(const fetcher of [async()=>new Response("server details",{status:500}),async()=>{throw Error("server secrets")},async()=>Response.json({visitors:[]})]) {
    const response=await portalVisitorsResponse("fixture",config,fetcher);
    assert.equal(response.status,502);assert.doesNotMatch(await response.text(),/server details|server secrets/);
  }
});
test("empty reports remain valid while all-user tracking starts",async()=>{
  const {normalizePortalVisitorsReport}=await lib;
  assert.deepEqual(normalizePortalVisitorsReport(report(0)),report(0));
});
test("the report preserves Unicode names and rejects impossible dates and visit totals",async()=>{
  const {normalizePortalVisitorsReport}=await lib;
  const data=report(1);data.visitors[0].full_name="  NIÑA DELA PEÑA  ";
  assert.equal(normalizePortalVisitorsReport(data).visitors[0].full_name,"NIÑA DELA PEÑA");
  for(const bad of [0,31,1.5,"9",true]) {
    const invalid=report(1);invalid.visitors[0].visit_days=bad;
    assert.throws(()=>normalizePortalVisitorsReport(invalid));
  }
  for(const field of ["period_start","period_end","tracking_started_on"]) {
    const invalid=report();invalid[field]="2026-02-30";
    assert.throws(()=>normalizePortalVisitorsReport(invalid));
  }
});


