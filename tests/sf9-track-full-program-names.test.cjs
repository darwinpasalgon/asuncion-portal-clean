const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const read = (p) => fs.readFileSync(path.join(__dirname, "..", p), "utf8");

test("SF9 spells out BE as Business and Entrepreneurship", () => {
  const formatter = read("lib/sf9-track-label.ts");
  const template = read("app/portal/sf9/Sf9PrintForms.tsx");
  assert.match(formatter, /BE: "Business and Entrepreneurship"/);
  assert.match(formatter, /BUSINESS_ENTREPRENEURSHIP: "Business and Entrepreneurship"/);
  assert.match(template, /sf9TrackLabel\(card\.track \|\| card\.shs_program_code\)/);
  assert.doesNotMatch(template, /<strong>\{card\.track \|\| ""\}<\/strong>/);
});

test("SF9 uses expanded programs without putting Medical or Engineering on the official STEM Track line", () => {
  const formatter = read("lib/sf9-track-label.ts");
  assert.match(formatter, /STEM: "Science, Technology, Engineering, and Mathematics"/);
  assert.match(formatter, /STEM_MEDICAL: "Science, Technology, Engineering, and Mathematics"/);
  assert.match(formatter, /STEM_ENGINEERING: "Science, Technology, Engineering, and Mathematics"/);
  assert.match(formatter, /ASSH: "Arts, Social Sciences, and Humanities"/);
  assert.match(formatter, /TVL: "Technical-Vocational-Livelihood"/);
  assert.match(formatter, /ABM: "Accountancy, Business, and Management"/);
  assert.match(formatter, /HUMSS: "Humanities and Social Sciences"/);
});

test("SF9 Track row permits long names within the existing printable layout", () => {
  const css = read("app/portal/sf9/sf9.module.css");
  assert.match(css, /\.identityTrackRow>strong\{[\s\S]*?grid-column:3 \/ -1/);
  assert.match(css, /\.identityTrackRow>strong\{[\s\S]*?overflow-wrap:break-word/);
  assert.match(css, /@page\{size:A4 landscape;margin:0\}/);
});
