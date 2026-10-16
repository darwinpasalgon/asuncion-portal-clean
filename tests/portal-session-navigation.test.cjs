const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

async function session(role, { adviser = true, activeYear = true, activeAccount = true } = {}) {
  const calls = [];
  const mod = { exports: {} };
  const source = fs.readFileSync(path.join(__dirname, "../app/api/auth/me/route.ts"), "utf8");
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    module: mod, exports: mod.exports, process, Response,
    require(name) {
      if (name === "@/lib/supabase-config") return { SUPABASE_URL: "https://school.example", SUPABASE_PUBLISHABLE_KEY: "public-test-key" };
      if (name === "next/server") return { NextResponse: { json(body, init = {}) { return { body, status: init.status ?? 200, cookies: { set() {} } }; } } };
      return require(name);
    },
    fetch: async (url) => {
      calls.push(url);
      let result = [];
      if (url.includes("/auth/v1/user")) result = { id: "teacher-123" };
      else if (url.includes("/profiles?")) result = [{ id: "teacher-123", role, account_status: activeAccount ? "active" : "pending" }];
      else if (url.includes("/school_years?")) result = activeYear ? [{ id: "year-active", name: "2026–2027" }] : [];
      else if (url.includes("/section_advisers?")) result = adviser ? [{ id: "assignment-1" }] : [];
      return Response.json(result);
    },
  });
  const response = await mod.exports.GET({ cookies: { get: name => name === "anhs-access-token" ? { value: "test-session" } : undefined } });
  return { response, calls };
}

test("adviser menu hint reads only the signed-in teacher's active-year assignment", async () => {
  const { response, calls } = await session("teacher");
  assert.equal(response.status, 200);
  assert.equal(response.body.isAdviser, true);
  const adviserCalls = calls.filter(url => url.includes("/section_advisers?"));
  assert.equal(adviserCalls.length, 1);
  const query = new URL(adviserCalls[0]).searchParams;
  assert.equal(query.get("teacher_id"), "eq.teacher-123");
  assert.equal(query.get("school_year_id"), "eq.year-active");
  assert.equal(query.get("is_active"), "eq.true");
  assert.equal(query.get("select"), "id");
  assert.equal(query.get("limit"), "1");
});

test("a subject teacher or a missing active year cannot acquire adviser navigation", async () => {
  assert.equal((await session("teacher", { adviser: false })).response.body.isAdviser, false);
  const noYear = await session("teacher", { activeYear: false });
  assert.equal(noYear.response.body.isAdviser, false);
  assert.ok(!noYear.calls.some(url => url.includes("/section_advisers?")));
});

test("students and administrators do not fetch teacher assignments for navigation", async () => {
  for (const role of ["student", "administrator", "staff_administrator"]) {
    const { response, calls } = await session(role);
    assert.equal(response.body.isAdviser, false);
    assert.ok(!calls.some(url => url.includes("/section_advisers?")));
  }
});

test("inactive accounts are rejected before any navigation hint is returned", async () => {
  const { response, calls } = await session("teacher", { activeAccount: false });
  assert.equal(response.status, 403);
  assert.equal(response.body.isAdviser, undefined);
  assert.ok(!calls.some(url => url.includes("/section_advisers?")));
});
