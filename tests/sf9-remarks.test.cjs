const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

function read(file) {
  return fs.readFileSync(path.join(__dirname, "..", file), "utf8");
}

test("SF9 remarks storage is protected for advisers and administrators", () => {
  const sql = read("supabase/migrations/20261013052615_sf9_automated_remarks.sql");

  assert.match(sql, /create table if not exists public\.sf9_teacher_remarks/);
  assert.match(sql, /term_no smallint not null check \(term_no between 1 and 3\)/);
  assert.match(sql, /source in \('automatic','manual'\)/);
  assert.match(sql, /alter table public\.sf9_teacher_remarks enable row level security/);
  assert.match(sql, /section_advisers/);
  assert.match(sql, /se\.student_id = sf9_teacher_remarks\.student_id/);
  assert.match(sql, /updated_by = \(select auth\.uid\(\)\)/);
});

test("SF9 automatic remarks use published grades and recorded attendance", () => {
  const route = read("app/api/academic/sf9/route.ts");

  assert.match(route, /status=eq\.published/);
  assert.match(route, /published_at/);
  assert.match(route, /buildTermRemarkSignal/);
  assert.match(route, /attendancePresence/);
  assert.match(route, /generateSf9Remark/);
  assert.match(route, /sf9_teacher_remarks/);
  assert.match(route, /comments: remarkDetails\.map\(\(item\) => item\.text\)/);
});

test("SF9 generated remarks avoid invented personality and behavior claims", () => {
  const helper = read("lib/sf9-remarks.ts");

  assert.match(helper, /Napakahusay ang akademikong pagganap/);
  assert.match(helper, /Regular ang pagpasok/);
  assert.match(helper, /Kailangang maging mas regular ang pagpasok/);
  assert.doesNotMatch(helper, /mabait|masayahin|madaldal|pakikipagkuwentuhan|paglalaro/i);
});

test("SF9 remarks remain editable and regeneratable before printing", () => {
  const page = read("app/portal/sf9/page.tsx");

  assert.match(page, /Automated Teacher&apos;s Remarks/);
  assert.match(page, /Review or edit them before printing/);
  assert.match(page, /Save Remarks/);
  assert.match(page, /Regenerate/);
  assert.match(page, /save_remarks/);
  assert.match(page, /maxLength=\{500\}/);
});

test("SF9 remarks panel stays out of the printed report card", () => {
  const css = read("app/portal/sf9/sf9.module.css");

  assert.match(css, /\.remarksPanel/);
  assert.match(
    css,
    /\.selectorPanel,\.remarksPanel,\.previewHeading,\.previewPlaceholder\{display:none!important\}/
  );
});
