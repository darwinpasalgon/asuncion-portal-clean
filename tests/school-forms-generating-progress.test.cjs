const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const read = (relativePath) => fs.readFileSync(path.join(__dirname, "..", relativePath), "utf8");

test("Shared school form generating progress is accessible and never fakes percentages", () => {
  const component = read("components/school-forms/GeneratingProgress.tsx");
  const css = read("components/school-forms/GeneratingProgress.module.css");
  assert.match(component, /form: "SF2" \| "SF9" \| "SF10"/);
  assert.match(component, /role="status"/);
  assert.match(component, /aria-live="polite"/);
  assert.match(component, /role="progressbar"/);
  assert.match(component, /aria-valuetext=\{message\}/);
  assert.doesNotMatch(component, /aria-valuenow/);
  assert.match(css, /@keyframes formLoading/);
  assert.match(css, /prefers-reduced-motion:reduce/);
  assert.match(css, /@media print\{\s*\.panel\{display:none!important\}/);
});

test("SF2 displays the generating bar for section load, attendance generation and print preparation", () => {
  const sf2 = read("app/portal/sf2/page.tsx");
  assert.match(sf2, /import \{ GeneratingProgress \}/);
  assert.match(sf2, /loadingBase \|\| loadingReport \|\| printing/);
  assert.match(sf2, /form="SF2"/);
  assert.match(sf2, /Generating monthly SF2/);
  assert.match(sf2, /Preparing SF2 for printing/);
  assert.match(sf2, /printWindow\.print\(\)/);
});

test("SF9 generating indicator covers section, A4 preview and printing without changing saved report data", () => {
  const sf9 = read("app/portal/sf9/page.tsx");
  assert.match(sf9, /import \{ GeneratingProgress \}/);
  assert.match(sf9, /loading \|\| loadingStudents \|\| loadingDetail \|\| loadingEditorDetail \|\| printingSf9/);
  assert.match(sf9, /form="SF9"/);
  assert.match(sf9, /Generating SF9 report card/);
  assert.match(sf9, /Preparing SF9 for printing/);
  assert.match(sf9, /setPrintingSf9\(true\)/);
  assert.match(sf9, /setPrintingSf9\(false\)/);
});

test("SF10 generating indicator covers learner fetch, record saving and print preparation", () => {
  const sf10 = read("app/portal/admin/sf10/page.tsx");
  assert.match(sf10, /import \{ GeneratingProgress \}/);
  assert.match(sf10, /working === "load" \|\| working === "save" \|\| working === "print"/);
  assert.match(sf10, /form="SF10"/);
  assert.match(sf10, /Generating SF10 permanent record/);
  assert.match(sf10, /Preparing SF10 for printing/);
  assert.match(sf10, /Saving SF10 permanent record/);
});
