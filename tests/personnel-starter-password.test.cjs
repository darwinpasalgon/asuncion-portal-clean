const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { stripTypeScriptTypes } = require("node:module");

function loadHandler(name, client) {
  const source = fs.readFileSync(path.join(__dirname, "..", "supabase/functions", name, "index.ts"), "utf8");
  const code = stripTypeScriptTypes(source.replace(/^import .*;\r?$/gm, ""));
  let handler;
  vm.runInNewContext(code, {
    Request, Response, crypto,
    createClient: () => client,
    Deno: { env: { get: () => "configured" }, serve: (callback) => { handler = callback; } },
  });
  return handler;
}
function request(body, token = "session") {
  return new Request("https://portal.test", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) },
    body: JSON.stringify(body),
  });
}
function query(client, table) {
  const filters = [];
  let patch;
  const builder = {
    select() { return this; },
    in(key, values) { filters.push((row) => values.includes(row[key])); return this; },
    eq(key, value) { filters.push((row) => row[key] === value); return this; },
    update(value) { patch = value; return this; },
    maybeSingle: async () => ({ data: client.profiles.find((row) => filters.every((fn) => fn(row))) ?? null, error: null }),
    then(resolve, reject) {
      if (table !== "profiles") return Promise.reject(new Error("Unexpected table " + table)).then(resolve, reject);
      const rows = client.profiles.filter((row) => filters.every((fn) => fn(row)));
      if (patch) {
        client.events.push("profile");
        client.profileUpdates.push({ ids: rows.map((row) => row.id), patch });
        if (!client.profileError) rows.forEach((row) => Object.assign(row, patch));
      }
      return Promise.resolve({ data: rows, error: patch ? client.profileError : null }).then(resolve, reject);
    },
  };
  return builder;
}
function fixture() {
  const client = {
    profiles: [
      { id: "admin", role: "administrator", admin_role: "super_administrator", account_status: "active", must_change_password: false },
      { id: "new-teacher", role: "teacher", full_name: "New Teacher", email: "new@deped.gov.ph", account_status: "active", must_change_password: true },
      { id: "new-staff", role: "staff_administrator", full_name: "New Staff", email: "staff@deped.gov.ph", account_status: "active", must_change_password: true },
      { id: "used", role: "teacher", account_status: "active", must_change_password: true },
      { id: "suspended", role: "teacher", account_status: "suspended", must_change_password: true },
      { id: "student", role: "student", account_status: "active", must_change_password: true },
      { id: "completed", role: "teacher", account_status: "active", must_change_password: false },
    ],
    users: ["admin", "new-teacher", "new-staff", "used", "suspended", "student", "completed"].map((id) => ({
      id, last_sign_in_at: ["admin", "used", "completed"].includes(id) ? "2026-11-01" : null, user_metadata: { retained: true },
    })),
    caller: "admin",
    authError: null, profileError: null, passwordUpdates: [], profileUpdates: [], events: [],
    from(table) { return query(this, table); },
  };
  client.auth = {
    getUser: async () => ({ data: { user: { id: client.caller } }, error: client.authError }),
    admin: {
      listUsers: async () => ({ data: { users: client.users }, error: null }),
      getUserById: async (id) => ({ data: { user: client.users.find((user) => user.id === id) }, error: null }),
      updateUserById: async (id, payload) => {
        client.events.push("password");
        client.passwordUpdates.push({ id, payload });
        return { error: client.passwordError ?? null };
      },
    },
  };
  return client;
}
test("first-login issuance requires a signed-in super administrator", async () => {
  const client = fixture();
  const handler = loadHandler("admin-personnel-first-login", client);
  assert.equal((await handler(request({ action: "candidates" }, ""))).status, 401);
  client.caller = "new-staff";
  assert.equal((await handler(request({ action: "issue", scope: "all", confirm: "ISSUE_FIRST_LOGIN_PASSWORDS" }))).status, 403);
  assert.equal(client.passwordUpdates.length, 0);
});
test("eligible count excludes prior sign-ins, students, suspended and completed accounts", async () => {
  const client = fixture();
  const response = await loadHandler("admin-personnel-first-login", client)(request({ action: "candidates" }));
  assert.deepEqual(await response.json(), { count: 2, teacher_count: 1, staff_count: 1 });
  assert.equal(client.passwordUpdates.length, 0);
});
test("CSV issuance uses the requested starter password only for eligible personnel", async () => {
  const client = fixture();
  const response = await loadHandler("admin-personnel-first-login", client)(request({
    action: "issue", scope: "all", confirm: "ISSUE_FIRST_LOGIN_PASSWORDS",
  }));
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.count, 2);
  assert.deepEqual(client.passwordUpdates.map((row) => row.id).sort(), ["new-staff", "new-teacher"]);
  assert.ok(body.issued.every((row) => row.temporary_password === "Asuncion123"));
  assert.ok(client.passwordUpdates.every((row) => row.payload.password === "Asuncion123" && row.payload.user_metadata.retained));
  assert.ok(client.profileUpdates.every((row) => row.patch.must_change_password === true && row.patch.temp_password_expires_at === null));
});
test("a personnel account that signs in during issuance is skipped", async () => {
  const client = fixture();
  client.auth.admin.getUserById = async (id) => ({
    data: { user: { ...client.users.find((user) => user.id === id), last_sign_in_at: id === "new-teacher" ? "2026-11-24" : null } },
    error: null,
  });
  const response = await loadHandler("admin-personnel-first-login", client)(request({
    action: "issue", scope: "all", confirm: "ISSUE_FIRST_LOGIN_PASSWORDS",
  }));
  const body = await response.json();
  assert.equal(body.count, 1);
  assert.equal(body.errors.length, 1);
  assert.equal(client.passwordUpdates[0].id, "new-staff");
});
test("first-login change rejects keeping the shared starter password", async () => {
  const client = fixture();
  client.caller = "new-teacher";
  const response = await loadHandler("password-change-complete", client)(request({ new_password: "Asuncion123" }));
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /different from the temporary password/);
  assert.equal(client.passwordUpdates.length, 0);
  assert.equal(client.profileUpdates.length, 0);
});
test("a private password is saved before clearing the required change flag", async () => {
  const client = fixture();
  client.caller = "new-teacher";
  const response = await loadHandler("password-change-complete", client)(request({ new_password: "Personal-Password-Example!" }));
  assert.equal(response.status, 200);
  assert.deepEqual(client.events, ["password", "profile"]);
  assert.equal(client.profiles.find((row) => row.id === "new-teacher").must_change_password, false);
});
test("failed password updates preserve the first-login restriction", async () => {
  const client = fixture();
  client.caller = "new-teacher";
  client.passwordError = { message: "Auth unavailable" };
  const response = await loadHandler("password-change-complete", client)(request({ new_password: "Personal-Password-Example!" }));
  assert.equal(response.status, 500);
  assert.equal(client.profileUpdates.length, 0);
  assert.equal(client.profiles.find((row) => row.id === "new-teacher").must_change_password, true);
});
test("failed profile updates never report first-login completion", async () => {
  const client = fixture();
  client.caller = "new-teacher";
  client.profileError = { message: "Database unavailable" };
  const response = await loadHandler("password-change-complete", client)(request({ new_password: "Personal-Password-Example!" }));
  assert.equal(response.status, 500);
  assert.match((await response.json()).error, /setup could not be completed/);
  assert.equal(client.profiles.find((row) => row.id === "new-teacher").must_change_password, true);
});
