const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const read = p => fs.readFileSync(path.join(__dirname,"..",p),"utf8");

test("Quezon Term 1 imports precisely the 42 Excel-assigned remarks from Y not Z, by LRN",()=>{
 const sql=read("supabase/migrations/20261015215500_grade9_quezon_excel_term1_remarks.sql");
 const values=sql.split("insert into sf9_quezon_term1_source(lrn,remark,row_no) values")[1].split("do $$")[0];
 const lrns=Array.from(values.matchAll(/\('(\d{12})',/g)).map(m=>m[1]);
 assert.equal(lrns.length,42);
 assert.equal(new Set(lrns).size,42);
 assert.match(sql,/TERM 1 SUMMARY.*column Y/);
 assert.match(sql,/column Z is the remark bank, NOT student assignment/);
 assert.match(sql,/join public.profiles p on p.lrn=src.lrn/);
 assert.match(sql,/s.name='Quezon' and s.grade_level=9/);
 assert.match(sql,/if matched<>42 then raise exception/);
 assert.match(sql,/if preexisting<>0 then raise exception/);
 assert.match(sql,/r.term_no=1/);
 assert.match(sql,/select current_year,p.id,1,src.remark,'manual'/);
 assert.doesNotMatch(sql,/update public.student_term_grades|delete from public.sf9_teacher_remarks/i);
});

test("Workbook original remarks are traceable but not readable from browser-facing roles",()=>{
 const sql=read("supabase/migrations/20261015215500_grade9_quezon_excel_term1_remarks.sql");
 assert.match(sql,/create table if not exists private.sf9_quezon_excel_remark_audit/);
 assert.match(sql,/revoke all on private.sf9_quezon_excel_remark_audit from public,anon,authenticated/);
 assert.match(sql,/source_cell text not null/);
 assert.match(sql,/original_remark text not null/);
});

test("Quezon Term 1 saved manual remark overrides automatic suggestions, Terms 2/3 remain automatic",()=>{
 const api=read("app/api/academic/sf9/route.ts");
 const page=read("app/portal/sf9/page.tsx");
 assert.match(api,/const saved = savedRemarkMap\.get/);
 assert.match(api,/text: saved\?\.remark \? String\(saved.remark\) : suggestion/);
 assert.match(api,/const suggestion = generateSf9Remark\(signal\)/);
 assert.match(page,/draft\?\.term_no === 1\) return/);
 assert.match(page,/Quezon Term 1 · Adviser Assigned/);
 assert.match(page,/Quezon Term 2 and other sections receive grade- and attendance-based/);
 assert.match(page,/onChange=\{\(event\) =>/);
});

test("Automatic Quezon-inspired remarks use published grade and attendance evidence, not behavior guesses",()=>{
 const source=read("lib/sf9-remarks.ts");
 const api=read("app/api/academic/sf9/route.ts");
 assert.match(source,/May magandang kakayahang matuto batay sa mataas na mga marka/);
 assert.match(source,/Kailangang maglaan ng dagdag na oras sa pagsasanay/);
 assert.match(source,/May kakayahang mapaunlad ang mga marka sa bawat aralin/);
 assert.doesNotMatch(source,/".*(?:mabait|pakikipagkuwentuhan|mahiyain|masayahin).*"/i);
 assert.match(api,/status=eq\.published/);
 assert.match(api,/recordedDays = presenceByDate.size/);
 const module={exports:{}};
 vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module,exports:module.exports});
 const signal={termAverage:92,gradeComplete:true,subjectCount:2,
  attendanceRate:98,classDays:20,lowestSubject:"Mathematics",lowestGrade:91,
  subjectGrades:[{label:"Mathematics",grade:91},{label:"English",grade:93}],
  variantSeed:"other-section:term-2"};
 const output=module.exports.generateSf9Remark(signal);
 assert.ok(output.length>30);
 assert.ok(output.length<=500);
 assert.match(output,/marka|pagganap/i);
 assert.equal(module.exports.generateSf9Remark({...signal,gradeComplete:false}),"");
 assert.notEqual(module.exports.generateSf9Remark(signal,0),module.exports.generateSf9Remark(signal,1));
});
