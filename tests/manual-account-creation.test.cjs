const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");

test("Manual account creation is visible only to Super Administrator in Users & Accounts",()=>{
 const list=read("app/portal/admin/users/page.tsx");
 const users=read("app/api/admin/users/route.ts");
 const endpoint=read("app/api/admin/manual-account/route.ts");
 assert.match(list,/canCreateAccounts/);
 assert.match(list,/href="\/portal\/admin\/create-account"/);
 assert.match(users,/canCreateAccounts: await isSuperAdministrator\(token\)/);
 assert.match(endpoint,/await isSuperAdministrator\(token\)/);
 assert.match(endpoint,/Super Administrator/);
});

test("Manual form supports students, teachers and non-teaching staff and downloads one-time credentials",()=>{
 const page=read("app/portal/admin/create-account/page.tsx");
 assert.match(page,/Student \/ Learner/);
 assert.match(page,/Teaching Personnel/);
 assert.match(page,/Non-Teaching Personnel/);
 assert.match(page,/pattern="\[0-9\]\{12\}"/);
 assert.match(page,/shsTrack/);
 assert.match(page,/shsProgram/);
 assert.match(page,/adminRole/);
 assert.match(page,/accessPermissions/);
 assert.match(page,/Download Credentials CSV/);
 assert.match(page,/URL\.createObjectURL/);
 assert.match(page,/must_change_password/);
 assert.doesNotMatch(page,/type="file"/);
});

test("Single-account API uses original Auth importer without direct browser database insertion",()=>{
 const endpoint=read("app/api/admin/manual-account/route.ts");
 assert.match(endpoint,/functions\/v1\/admin-bulk-account-import/);
 assert.match(endpoint,/person_type:"student"/);
 assert.match(endpoint,/person_type:"teacher"/);
 assert.match(endpoint,/action="create_non_teaching_account"/);
 assert.match(endpoint,/if \(!\/\^\\d\{12\}\$\/\.test\(lrn\)\)/);
 assert.match(endpoint,/teachingPositions/);
 assert.match(endpoint,/nonTeachingPositions/);
 assert.match(endpoint,/roleChoices/);
 assert.match(endpoint,/Cache-Control":"no-store, private"/);
 assert.doesNotMatch(endpoint,/service_role|SERVICE_ROLE_KEY/);
});

test("Non-teaching Auth provisioning enforces explicit role, duplicate-checks personnel, and only grants selected permissions",()=>{
 const service=read("supabase/functions/admin-bulk-account-import/index.ts");
 assert.match(service,/action === "create_non_teaching_account"/);
 assert.match(service,/caller.admin_role !== "super_administrator"/);
 assert.match(service,/\["registrar","content_administrator","school_administrator"\]/);
 assert.match(service,/admin\.auth\.admin\.createUser/);
 assert.match(service,/requested_role:"administrator"/);
 assert.match(service,/profile.role !== "staff_administrator"/);
 assert.match(service,/directoryEntry\?\.portal_user_id/);
 assert.match(service,/existingByName/);
 assert.match(service,/\.is\("portal_user_id",null\)\.select\("id"\)\.maybeSingle\(\)/);
 assert.match(service,/administrator_permissions/);
 assert.match(service,/grantError/);
 assert.match(service,/admin\.auth\.admin\.deleteUser\(userId\)/);
 assert.match(service,/temporary_password:password/);
});

test("Person-specific provisioning leaves bulk workflow intact",()=>{
 const service=read("supabase/functions/admin-bulk-account-import/index.ts");
 const importer=read("app/api/admin/import-accounts/route.ts");
 assert.match(service,/if \(action !== "import"\) return json/);
 assert.match(service,/person_type === "teacher" \? "teacher" : "student"/);
 assert.match(importer,/bulk_import\.manage/);
 assert.match(importer,/person_type: body.personType === "teacher" \? "teacher" : "student"/);
});
