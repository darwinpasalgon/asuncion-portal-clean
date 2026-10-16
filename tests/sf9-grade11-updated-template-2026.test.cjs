const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const read = (p) => fs.readFileSync(path.join(__dirname, "..", p), "utf8");

test("Revised Grade 11 SF9 uses exact Filipino label and five six-unit core areas", () => {
  const src = read("lib/sf9-grade11-layout.ts");
  assert.match(src, /Pag-Aaral ng Kasaysayan at Lipunang Pilipino/);
  assert.match(src, /GRADE11_SF9_CORE_UNITS = 6/);
  assert.match(src, /GRADE11_SF9_ELECTIVE_UNITS = 3/);
  assert.match(src, /GRADE11_SF9_TEMPLATE_TOTAL_UNITS = 39/);
  assert.match(src, /shs11-language-heading/);
  assert.match(src, /units: unitFor\("Effective Communication",GRADE11_SF9_CORE_UNITS\)/);
  assert.match(src, /units: indent \? null/);
  assert.match(src, /const communicationTerms/);
  assert.match(src, /termNo - 1\] = grade/);
});

test("Revised Grade 11 SF9 column order and Excel merged group rows match template", () => {
  const forms = read("app/portal/sf9/Sf9PrintForms.tsx");
  const css = read("app/portal/sf9/sf9.module.css");
  const start = forms.indexOf('<thead>',forms.indexOf('function FrontCard'));
  const sub = forms.slice(start,start+850);
  assert.ok(sub.indexOf('colSpan={3}>TERM') < sub.indexOf('className={styles.unitsCol}'),
    "Term must precede Units");
  assert.match(forms, /td colSpan=\{card\.grade_level === 11 \? 7 : 6\}/);
  assert.match(forms, /<td colSpan=\{4\}>General Average<\/td>/);
  assert.match(forms, /sf9Grade11TotalUnits\(rows\)/);
  assert.match(forms, /styles\.grade11UnusedTerm/);
  assert.match(css, /\.grade11UnusedTerm\{background:#aaa!important\}/);
  assert.match(css, /\.shsIndentedRow td:first-child\{[^}]*font-style:italic/);
  assert.match(css, /\.grade11GeneralAverage td:first-child\{[^}]*font-style:italic/);
  assert.match(forms, /: padGradeRows\(card\.grade_rows\)/);
});

test("Existing Grade 11 elective catalog rows receive three units unless locally overridden", () => {
  const sql = read("supabase/migrations/20261016162000_grade11_sf9_updated_units_labels.sql");
  const model = read("lib/sf9-grade11-layout.ts");
  assert.match(sql, /where grade_level=11 and name='Pag-Aaral ng Kasanayan at Lipunang Pilipino'/);
  assert.match(sql, /o\.category='core'/);
  assert.match(sql, /o\.units is null/);
  assert.match(sql, /o\.category='elective'/);
  assert.match(model, /units: typeof offer\.units === "number" \? offer\.units : GRADE11_SF9_ELECTIVE_UNITS/);
  assert.match(model, /const slots = offered\.length \? offered : \[\{term_no:termNo,name:"",units:null\}\]/);
  assert.doesNotMatch(model, /label: "Academic Elective [123]"/);
});
