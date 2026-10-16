const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const read = (name) => fs.readFileSync(path.join(__dirname, "..", name), "utf8");

test("Personnel login directory is exclusively accessible to Super Administrator and never returns passwords", () => {
  const api = read("app/api/admin/personnel-login-directory/route.ts");
  assert.match(api, /isSuperAdministrator\(token\)/);
  assert.match(api, /role: "in\.\(teacher,administrator,staff_administrator\)"/);
  assert.match(api, /Cache-Control": "private, no-store"/);
  assert.doesNotMatch(api, /export async function POST/);
  assert.doesNotMatch(api, /admin\.auth\.admin\.listUsers/);
  assert.doesNotMatch(api, /select: "[^"]*password_hash/);
  assert.match(api, /Original and existing passwords cannot be retrieved/);
});

test("Super administrator can discover personnel login CSV and recover eligible first-login passwords", () => {
  const menu = read("lib/portal-navigation.ts");
  const users = read("app/portal/admin/users/page.tsx");
  const teacherImport = read("app/portal/admin/teacher-import/page.tsx");
  const ui = read("app/portal/admin/personnel-credentials/page.tsx");
  assert.match(menu, /label: "Personnel Login Credentials"/);
  assert.match(menu, /href: "\/portal\/admin\/personnel-credentials"/);
  assert.match(users, /canCreateAccounts && <a[^>]*href="\/portal\/admin\/personnel-credentials"/);
  assert.match(teacherImport, /id="first-login-credentials"/);
  assert.match(teacherImport, /Generate & Download Fresh Credentials/);
  assert.match(ui, /\/portal\/admin\/teacher-import#first-login-credentials/);
  assert.match(ui, /ANHS_Personnel_Login_Directory\.csv/);
  assert.match(ui, /\/portal\/admin\/password-resets/);
});

test("CSV directory contains logins and status, not passwords, and is protected from spreadsheet formula injection", () => {
  const ui = read("app/portal/admin/personnel-credentials/page.tsx");
  assert.match(ui, /Login Email/);
  assert.match(ui, /Password Change Required/);
  assert.match(ui, /safeCell/);
  assert.match(ui, /replace\(\/"\/g, '""'\)/);
  assert.doesNotMatch(ui, /row\.temporary_password/);
  assert.doesNotMatch(ui, /row\.password\b/);
  assert.match(ui, /role === "administrator"/);
  assert.match(ui, /role === "teacher"/);
});
