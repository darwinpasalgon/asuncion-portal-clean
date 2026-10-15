const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const read=(f)=>fs.readFileSync(path.join(__dirname,"..",f),"utf8");

test("Grade 12 subject catalog is visible with its own direct Edit Name action",()=>{
 const page=read("app/portal/admin/teaching/page.tsx");
 const styles=read("app/portal/admin/teaching/teaching.module.css");
 assert.match(page,/id="grade12-subjects"/);
 assert.match(page,/Grade 12 Subjects · First &amp; Second Term/);
 assert.match(page,/grade12Subjects\.map/);
 assert.match(page,/void editSubject\(subject\)/);
 assert.match(page,/grade12SubjectGrid/);
 assert.match(page,/Teaching Load \/ Schedule Only/);
 assert.match(styles,/\.grade12SubjectGrid/);
});

test("Grade 12 subject imports distinguish HGP, ARAL, and split TVL without duplication",()=>{
 const migration=read("supabase/migrations/20261015143000_grade12_subject_catalog_from_class_programs.sql");
 assert.match(migration,/on conflict \(grade_level,name\) do nothing/);
 assert.match(migration,/ORGANIC AGRICULTURE PRODUCTION/);
 assert.match(migration,/FOOD PROCESSING/);
 assert.match(migration,/ARAL PROGAM/);
 assert.match(migration,/PRINIPLES OF MARKETING/);
 assert.match(migration,/name like 'ARAL %'/);
 assert.match(migration,/case when name like 'ARAL %' or name='HGP' then false/);
});

test("Renaming a Grade 12 catalog subject updates both term schedules, but not other grades",()=>{
 const migration=read("supabase/migrations/20261015143000_grade12_subject_catalog_from_class_programs.sql");
 const route=read("app/api/admin/teaching-setup/route.ts");
 assert.match(migration,/new.grade_level = 12/);
 assert.match(migration,/old.grade_level = 12/);
 assert.match(migration,/update public\.grade12_term_periods/);
 assert.match(migration,/split_part\(p.subject_label,'\/',1\)/);
 assert.match(migration,/split_part\(p.subject_label,'\/',2\)/);
 assert.match(migration,/after update of name on public.subjects/);
 assert.match(route,/action === "update_subject"/);
});
