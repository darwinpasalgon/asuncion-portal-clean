const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

function read(file) {
  return fs.readFileSync(path.join(__dirname, "..", file), "utf8");
}

test("production metadata does not advertise a development preview", () => {
  const layout = read("app/layout.tsx");
  assert.doesNotMatch(layout, /codex-preview|development/);
});

test("baseline browser security headers remain configured", () => {
  const config = read("next.config.ts");
  for (const header of [
    "X-Content-Type-Options",
    "X-Frame-Options",
    "Referrer-Policy",
    "Permissions-Policy",
  ]) {
    assert.match(config, new RegExp(header));
  }
  assert.match(config, /nosniff/);
  assert.match(config, /DENY/);
});

test("public registration remains closed", () => {
  const page = read("app/register/page.tsx");
  const api = read("app/api/auth/register/route.ts");
  assert.match(page, /redirect\("\/"\)/);
  assert.match(api, /Public registration is closed/);
  assert.match(api, /status:\s*403/);
});

test("saved sign-in uses refresh tokens with a persistent cookie window", () => {
  for (const file of [
    "app/api/auth/login/route.ts",
    "app/api/auth/me/route.ts",
    "proxy.ts",
  ]) {
    const source = read(file);
    assert.match(source, /anhs-refresh-token/);
    assert.match(source, /60 \* 60 \* 24 \* 60/);
    assert.match(source, /httpOnly:\s*true/);
    assert.match(source, /sameSite:\s*"lax"/);
  }
});

test("legacy class schedule URL keeps its compatibility redirect", () => {
  const config = read("next.config.ts");
  assert.match(config, /\/portal\/admin\/class-schedules/);
  assert.match(config, /\/portal\/admin\/schedules/);
});
