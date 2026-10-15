const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");

test("Grade 12 source class programs preserve 296 and 306 day periods separately",()=>{
 const d=JSON.parse(read("supabase/data/grade12-term-class-program-2026-2027.json"));
 const periods=d.groups.split(";").flatMap(group=>{
   const [term,section,time,subject,teacher,sourceRow,mask]=group.split(",").map(Number);
   return [1,2,3,4,5].filter(day=>mask & (1<<(day-1))).map(day=>({term,section,time,subject,teacher,sourceRow,day}));
 });
 assert.equal(periods.length,602);
 assert.equal(periods.filter(p=>p.term===1).length,296);
 assert.equal(periods.filter(p=>p.term===2).length,306);
 assert.equal(d.sections.length,11);
 assert.equal(periods.filter(p=>p.section===0&&p.day!==5).length,0); // Courage Friday only
});

test("Grade 12 term schedule storage cannot overwrite other grades or term assignments",()=>{
 const schema=read("supabase/migrations/20261015120500_grade12_term_class_program_schedule.sql");
 const api=read("app/api/admin/grade12-term-program/route.ts");
 const proxy=read("proxy.ts");
 const view=read("app/portal/admin/schedules/grade12-inline.tsx");
 const standard=read("app/portal/admin/schedules/page.tsx");
 const retired=read("app/portal/admin/grade12-term-program/page.tsx");
 assert.match(schema,/grade12_term_periods/);
 assert.match(schema,/term_no smallint not null/);
 assert.match(schema,/end_time <= time '16:45'/);
 assert.match(schema,/unique \(school_year_id,section_id,term_no,day_of_week,source_row\)/);
 assert.match(schema,/row level security/);
 assert.match(api,/getScopedAdminAccess\(token, "schedules.manage"\)/);
 assert.match(api,/term_no=eq\.\$\{existing.term_no\}/);
 assert.match(view,/Term 1/);
 assert.match(view,/Term 2/);
 assert.match(view,/Subject Teacher/);
 assert.match(standard,/Grade12SchedulesInline/);
 assert.match(retired,/redirect\("/);
 assert.match(proxy,/\/portal\/admin\/grade12-term-program/);
 assert.doesNotMatch(api,/from\("class_schedules"\)|table=teacher_assignments/);
});

test("Jane Bardon is onboarded through the existing Super Admin-protected Auth importer",()=>{
 const page=read("app/portal/admin/schedules/grade12-inline.tsx");
 const api=read("app/api/admin/grade12-term-program/route.ts");
 const bulk=read("app/api/admin/import-accounts/route.ts");
 assert.match(page,/jane\.bardon\.2026@temp\.asuncion-nhs\.invalid/);
 assert.match(page,/personType:"teacher"/);
 assert.match(page,/action:"link_jane_bardon"/);
 assert.match(page,/setJanePassword/);
 assert.match(page,/Download Temporary Credentials/);
 assert.match(api,/if \(body\?\.action === "link_jane_bardon"\)/);
 assert.match(api,/await isSuperAdministrator\(info\.token\)/);
 assert.match(api,/profiles\?email=eq\./);
 assert.match(bulk,/functions\/v1\/admin-bulk-account-import/);
});

test("Old Grade 12 screen retires; existing JHS screen and records stay intact",()=>{
 const portal=read("app/portal/page.tsx");
 const schedules=read("app/portal/admin/schedules/page.tsx");
 const retired=read("app/portal/admin/grade12-term-program/page.tsx");
 const internal=read("app/portal/admin/schedules/grade12-inline.tsx");
 assert.doesNotMatch(portal,/window.location.href = "\/portal\/admin\/grade12-term-program"/);
 assert.match(retired,/redirect\("\/portal\/admin\/schedules\?/);
 assert.match(schedules,/quickGrade === "12"/);
 assert.match(schedules,/!teacherView && quickGrade/);
 assert.match(internal,/styles.quickRows/);
 assert.match(internal,/styles.scheduleList/);
 assert.match(internal,/update_period/);
 assert.match(internal,/Teacher Schedule/);
});

test("Grade 12 stays navigable with visible Grade Level and Section selectors",()=>{
 const c=read("app/portal/admin/schedules/page.tsx");
 const pos=c.indexOf('!teacherView && quickGrade === "12"');
 assert.ok(pos>0);
 const branch=c.slice(pos,c.indexOf(") : (",pos));
 assert.match(branch,/Grade Level/);
 assert.match(branch,/Section/);
 assert.match(branch,/setQuickGrade/);
 assert.match(branch,/setQuickSection/);
 assert.match(branch,/Grade12SchedulesInline/);
});
