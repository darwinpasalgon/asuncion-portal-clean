const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

function read(file) {
  return fs.readFileSync(path.join(__dirname, "..", file), "utf8");
}

test("bulk import submits Ready rows even when existing accounts are present", () => {
  const page = read("app/portal/admin/masterlist/page.tsx");

  assert.match(
    page,
    /const valid = rows\.filter\(\s*\(row\) => row\.valid && row\.status === "ready"/
  );
  assert.doesNotMatch(
    page,
    /if \(!file \|\| !valid\.length \|\| summary\.invalid > 0\) return/
  );
  assert.match(
    page,
    /disabled=\{working \|\| summary\.ready === 0\}/
  );
  assert.match(page, /Create Ready Accounts/);
});

test("existing LRNs are clearly skipped instead of treated as blocking corrections", () => {
  const page = read("app/portal/admin/masterlist/page.tsx");

  assert.match(page, /existingAccount = true/);
  assert.match(page, /status: "ready" \| "existing" \| "invalid" \| "created"/);
  assert.match(page, /Already Existing/);
  assert.match(page, /existing account.*will be skipped/);
});

test("row-level backend skips do not discard successfully created accounts", () => {
  const page = read("app/portal/admin/masterlist/page.tsx");
  const fn = read("supabase/functions/admin-bulk-account-import/index.ts");

  assert.match(page, /serverFailures\.push\(\.\.\.result\.errors\)/);
  assert.doesNotMatch(
    page,
    /throw new Error\(\s*\`\$\{result\.errors\.length\} row\(s\) were skipped/
  );
  assert.match(page, /Account created in this import/);
  assert.match(fn, /failures\.push/);
  assert.match(fn, /continue;/);
  assert.match(fn, /accounts: successes/);
  assert.match(fn, /errors: failures/);
});

test("only Ready rows receive temporary credentials", () => {
  const page = read("app/portal/admin/masterlist/page.tsx");

  assert.match(page, /rows: valid\.slice\(start, start \+ 200\)/);
  assert.match(page, /Download the temporary credentials now/);
});
