const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const read = (p) => fs.readFileSync(path.join(__dirname, "..", p), "utf8");

test("SF2 excludes transferred-out learners from printed roster and daily attendance counts", () => {
  const api = read("app/api/academic/sf2/route.ts");
  assert.match(api, /is_transferred_out:\s*String\(enrollment\.learner_status/);
  assert.match(api, /enrollment\.enrollment_status/);
  assert.match(api, /Boolean\(transferOutDate/);
  assert.match(api, /const printLearners = learners\.filter\(\(learner\) => !learner\.is_transferred_out\)/);
  assert.match(api, /const males = printLearners\.filter/);
  assert.match(api, /const females = printLearners\.filter/);
  assert.match(api, /missing: printLearners\.filter/);
  // Preserve the transfer-out totals from full historical records.
  assert.match(api, /for \(const learner of learners\)/);
  assert.match(api, /transferred_out: withTotal\(transferOut\)/);
});

test("SF2 print output hides scrollbar and uses smaller undistorted DepEd wordmark", () => {
  const css = read("app/portal/sf2/sf2.module.css");
  assert.match(css, /@page\{\s*size:A4 landscape/);
  assert.match(css, /\.previewFrame\{\s*overflow:visible!important/);
  assert.match(css, /\.previewFrame::-webkit-scrollbar/);
  assert.match(css, /scrollbar-width:none!important/);
  assert.match(css, /width:35mm;\s*height:14\.5mm/);
  assert.match(css, /sf2-deped-wordmark\)\{\s*object-fit:contain/);
  assert.match(css, /zoom:\.975/);
});

test("SF2 uses a separate non-scrollable print sheet rather than printing the preview frame", () => {
  const page = read("app/portal/sf2/page.tsx");
  const css = read("app/portal/sf2/sf2.module.css");
  assert.match(page, /className=\{\`\$\{styles\.printOnly\} \$\{styles\.printScope\}\`\}/);
  assert.match(page, /printDoc\.querySelectorAll<HTMLImageElement>\("img"\)/);
  assert.match(css, /\.printOnly\{display:none\}/);
  assert.match(css, /@media print\{[\s\S]*?\.page\{display:none!important\}/);
  assert.match(css, /\.printOnly\{[\s\S]*?display:block!important/);
  assert.match(css, /\.printOnly\{[\s\S]*?overflow:visible!important/);
});

test("SF2 actually prints an isolated iframe document, not the main browser page", () => {
  const page = read("app/portal/sf2/page.tsx");
  assert.match(page, /document\.createElement\("iframe"\)/);
  assert.match(page, /document\.body\.appendChild\(iframe\)/);
  assert.match(page, /printDocument\.outerHTML/);
  assert.match(page, /head link\[rel="stylesheet"\]/);
  assert.match(page, /printDoc\.fonts\?\.ready/);
  assert.match(page, /const images = Array\.from\(printDoc\.querySelectorAll/);
  assert.match(page, /printWindow\.print\(\)/);
  assert.match(page, /printWindow\.addEventListener\("afterprint", dispose/);
  assert.doesNotMatch(page, /(^|[^.\w])window\.print\(\)/);
});
