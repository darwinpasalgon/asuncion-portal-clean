const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

const read = p => fs.readFileSync(path.join(__dirname, "..", p), "utf8");
const source = read("lib/sf9-attendance.ts");
const mod = { exports: {} };
vm.runInNewContext(ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText, { module: mod, exports: mod.exports });
const { sf9InstructionalDates, sf9AttendanceSummary, sf9AttendanceValue, sf9MonthKey } = mod.exports;

test("SF9 calendar starts June 8, skips weekends and excluded school suspensions", () => {
  const days = sf9InstructionalDates({
    startDate:"2026-06-08",currentDate:"2026-06-12",startYear:2026,
    excludedDates:["2026-06-10"]
  });
  assert.deepEqual(Array.from(days), ["2026-06-08","2026-06-09","2026-06-11","2026-06-12"]);
  assert.equal(sf9MonthKey("2027-01-05",2026),"Jan");
  assert.equal(sf9MonthKey("2026-01-05",2026),null);
  assert.equal(sf9MonthKey("2027-05-05",2026),null);
});

test("SF9 present and absent reflect only recorded statuses; half-days split 0.5 each", () => {
  const classDates = ["2026-06-08","2026-06-09","2026-06-11","2026-06-12"];
  const result = sf9AttendanceSummary({
    classDates,startYear:2026,studentEntries:[
      {attendance_date:"2026-06-08",status:"present"},
      {attendance_date:"2026-06-09",status:"absent"},
      {attendance_date:"2026-06-11",status:"absent_afternoon"},
      {attendance_date:"2026-06-10",status:"absent"}, // excluded date
      {attendance_date:"2026-06-13",status:"absent"}, // weekend
    ]
  });
  assert.equal(result.class_days.Jun,4);
  assert.equal(result.days_present.Jun,1.5);
  assert.equal(result.days_absent.Jun,1.5);
  assert.equal(result.recorded_days.Jun,3);
  assert.equal(result.unrecorded_days.Jun,1);
  assert.equal(result.total_present + result.total_absent,result.total_recorded);
  assert.equal(result.total_class_days,4);
  assert.equal(result.total_unrecorded,1);
});

test("Official national holidays and the DepEd 2026 school calendar are excluded",()=>{
 const calendar=sf9InstructionalDates({
   startDate:"2026-06-08",currentDate:"2026-08-31",startYear:2026,excludedDates:[]
 });
 const days=Array.from(calendar);
 assert.equal(days.filter(date=>date.startsWith("2026-06")).length,16);
 assert.equal(days.filter(date=>date.startsWith("2026-07")).length,23);
 assert.equal(days.filter(date=>date.startsWith("2026-08")).length,19);
 assert.equal(days.includes("2026-06-12"),false);
 assert.equal(days.includes("2026-08-21"),false);
 assert.equal(days.includes("2026-08-31"),false);
 const finalDays=sf9InstructionalDates({
   startDate:"2026-06-08",currentDate:"2027-04-30",startYear:2026,excludedDates:[]
 });
 assert.equal(finalDays.at(-1),"2027-04-08");
});
test("SF9 counts Absent in the Morning as a half day; incomplete months remain unrecorded", () => {
  const result=sf9AttendanceSummary({startYear:2026,
    classDates:["2026-09-01","2026-09-02","2026-10-01","2026-10-02"],
    studentEntries:[
      {attendance_date:"2026-09-01",status:"absent_morning"},
      {attendance_date:"2026-09-02",status:"cutting_classes"},
      {attendance_date:"2026-10-01",status:"transferred_in"},
    ]
  });
  assert.equal(result.days_present.Sep,1.5);
  assert.equal(result.days_absent.Sep,0.5);
  assert.equal(result.recorded_days.Sep,2);
  assert.equal(result.recorded_days.Oct,0);
  assert.equal(result.days_absent.Oct,0);
  assert.equal(result.unrecorded_days.Oct,2);
});

test("Later corrected attendance replaces the old status, not another attendance day", () => {
  const result=sf9AttendanceSummary({startYear:2026,classDates:["2026-10-05"],
    studentEntries:[
      {attendance_date:"2026-10-05",status:"absent"},
      {attendance_date:"2026-10-05",status:"present"},
    ]
  });
  assert.equal(result.total_present,1);
  assert.equal(result.total_absent,0);
  assert.equal(result.total_recorded,1);
});

test("SF9 report card does not infer absent from class days minus presence",()=>{
  const api=read("app/api/academic/sf9/route.ts");
  const print=read("app/portal/sf9/Sf9PrintForms.tsx");
  const page=read("app/portal/sf9/page.tsx");
  assert.match(api,/sf9InstructionalDates\(/);
  assert.match(api,/attendanceStartDate\(activeYear\)/);
  assert.match(api,/attendance_day_exclusions/);
  assert.match(api,/sf9AttendanceSummary\(/);
  assert.doesNotMatch(api,/Math\.max\(0, classDaysByMonth\[item.key\] - presentByMonth\[item.key\]\)/);
  assert.match(print,/attendance\.recorded_days\?\.\[month\]/);
  assert.match(page,/Attendance Records Incomplete/);
  assert.match(api,/recordedDays = presenceByDate.size/);
});
