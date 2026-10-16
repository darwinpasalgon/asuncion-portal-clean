const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");

test("Attendance date picker automatically fetches saved entries for selected date",()=>{
 const ui=read("app/portal/attendance/page.tsx");
 assert.match(ui,/setDate\(next\);if\(next\)void load\(next,sectionId\)/);
 assert.match(ui,/const requestId=\+\+loadSequence\.current/);
 assert.match(ui,/requestId!==loadSequence\.current/);
 assert.match(ui,/setLoadedDate\(targetDate\)/);
 assert.match(ui,/loadedDate!==date/);
 assert.match(ui,/Saved attendance/gi);
});

test("Saved date updates only changed learners and allows per-learner save without altering classmates",()=>{
 const api=read("app/api/academic/attendance/route.ts");
 const ui=read("app/portal/attendance/page.tsx");
 assert.match(api,/action !== "save_attendance" && action !== "update_attendance"/);
 assert.match(api,/action === "save_attendance" && records.length !== allowedStudents.size/);
 assert.match(api,/action === "update_attendance"/);
 assert.match(api,/This date has no saved attendance yet/);
 assert.match(ui,/roster\.filter\(s=>studentId \? s\.id===studentId : isChanged\(s\.id\)\)/);
 assert.match(ui,/action:hasSavedAttendance\?"update_attendance":"save_attendance"/);
 assert.match(ui,/save\(student.id\)/);
 assert.match(ui,/Save This Learner/);
 assert.match(ui,/Save \$\{changedStudents.length\} Change/);
 assert.doesNotMatch(api,/records.length !== allowedStudents.size\) \{\s*return NextResponse.json\(\s*\{ error: "Tag attendance for every active learner before saving."/);
});

test("SF2 print generates current report automatically and prints only after rendering",()=>{
 const page=read("app/portal/sf2/page.tsx");
 const css=read("app/portal/sf2/sf2.module.css");
 assert.match(page,/async function printSf2\(\)/);
 assert.match(page,/if \(!await loadReport\(sectionId, month\)\) return/);
 assert.match(page,/requestAnimationFrame\(\(\) => requestAnimationFrame/);
 assert.match(page,/document\.fonts\?\.ready/);
 assert.match(page,/img\.decode\?\.\(\)/);
 assert.match(page,/printWindow\.print\(\)/);
 assert.match(page,/previewIsCurrent/);
 assert.match(page,/onClick=\{\(\) => void printSf2\(\)\}/);
 assert.match(css,/@page\{\s*size:A4 landscape/);
 assert.match(css,/zoom:\.975/);
});
