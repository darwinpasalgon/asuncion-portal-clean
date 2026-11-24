const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { pathToFileURL } = require("node:url");
const { stripTypeScriptTypes } = require("node:module");
const root = path.join(__dirname, "..");
const ids = { teacher: "11111111-1111-4111-8111-111111111111", other: "22222222-2222-4222-8222-222222222222", student: "33333333-3333-4333-8333-333333333333", plan: "44444444-4444-4444-8444-444444444444", session: "55555555-5555-4555-8555-555555555555", year: "66666666-6666-4666-8666-666666666666", section: "77777777-7777-4777-8777-777777777777" };
const modules = Promise.all(["learning-workspaces.ts", "ilaw-docx.ts", "portal-navigation.ts"].map(file => import(pathToFileURL(path.join(root, "lib", file)).href)));
const content = () => ({
  title: "Safe PC assembly & disassembly", subject: "CSS", grade_level: 8, section: "Sample", term_no: 2, week_no: 1,
  lesson_date: "2026-11-24", duration_minutes: 60, language: "English / Filipino",
  competencies: "Use the supplied assembly procedure safely.", learner_context: "Group practice using shared equipment.",
  references: "Teacher-provided BOW", materials: "A training PC",
  sessions: [{ intentions: "Sequence the supplied steps.", learning_experiences: "Demonstrate, practise, and explain.", assessment: "Use the supplied checklist.", ways_forward: "" }],
});
function load(relative, scope, names) {
  const source = fs.readFileSync(path.join(root, relative), "utf8").replace(/^import .*;\r?$/gm, "");
  const code = stripTypeScriptTypes(source, { mode: "transform" }).replace(/^export /gm, "");
  const mod = { exports: {} };
  vm.runInNewContext(code + "\nmodule.exports = {" + names.join(",") + "};", { ...scope, module: mod, exports: mod.exports });
  return mod.exports;
}
async function route(relative, role, handler = () => []) {
  const [validation] = await modules;
  const calls = [];
  const profile = { id: role === "student" ? ids.student : ids.teacher, full_name: "Synthetic Test User", role, account_status: "active", must_change_password: false };
  const fetcher = async (raw, init = {}) => {
    const url = new URL(raw), body = init.body ? JSON.parse(init.body) : null;
    calls.push({ url, method: init.method ?? "GET", body, headers: init.headers });
    if (url.pathname === "/auth/v1/user") return Response.json({ id: profile.id });
    if (url.pathname === "/rest/v1/profiles" && url.searchParams.get("id") === "eq." + profile.id) return Response.json([profile]);
    const result = handler({ url, method: init.method ?? "GET", body });
    return result instanceof Response ? result : Response.json(result);
  };
  const scope = {
    fetch: fetcher, Response, Request, URL, URLSearchParams,
    SUPABASE_URL: "https://school.test", SUPABASE_PUBLISHABLE_KEY: "publishable-test-key",
    NextResponse: { json: (value, init) => Response.json(value, init) },
    ...validation,
  };
  const helpers = load("lib/learning-server.ts", scope, ["LearningError", "learningHeaders", "learningJson", "learningFailure", "learningRows", "learningIdentity", "learningBody"]);
  const mod = load(relative, { ...scope, ...helpers }, ["GET", "POST"]);
  function request(body, query = "") {
    const r = new Request("https://portal.test/api/test" + query, { method: body ? "POST" : "GET", ...(body ? { body: JSON.stringify(body), headers: { "Content-Type": "application/json" } } : {}) });
    r.cookies = { get: () => ({ value: "signed-in-test-session" }) };
    r.nextUrl = new URL(r.url);
    return r;
  }
  return { ...mod, profile, calls, request };
}
test("teacher-led ILAW preserves supplied content and does not invent reflections", async () => {
  const [m] = await modules;
  const plan = m.validateIlaw(content(), true);
  assert.equal(plan.sessions[0].ways_forward, "");
  assert.equal(plan.competencies, content().competencies);
  assert.equal(plan.references, content().references);
});
test("ready ILAW plans require competencies and each session's learning sequence and assessment", async () => {
  const [m] = await modules;
  for (const key of ["intentions", "learning_experiences", "assessment"]) {
    const c = content(); c.sessions[0][key] = "";
    assert.throws(() => m.validateIlaw(c, true), /required/);
    assert.doesNotThrow(() => m.validateIlaw(c, false));
  }
  for (const sessions of [[], Array.from({ length: 6 }, () => content().sessions[0])]) assert.throws(() => m.validateIlaw({ ...content(), sessions }), /five sessions/);
});
test("dates, grade levels, and numeric learning checks reject invalid values", async () => {
  const [m] = await modules;
  assert.throws(() => m.validateIlaw({ ...content(), grade_level: 6 }), /Grade level/);
  assert.throws(() => m.day("2026-02-30"), /valid date/);
  const base = { plan_id: ids.plan, session_date: "2026-11-24", activity: "Read the assigned text.", attendance: "present", assessment_name: "Five-item check", score: "4", max_score: "5" };
  assert.equal(m.validateSupportSession(base).score, 4);
  for (const changes of [{ score: "6" }, { score: "-1" }, { max_score: "0" }, { score: "", max_score: 5 }, { score: true }, { assessment_name: "" }]) assert.throws(() => m.validateSupportSession({ ...base, ...changes }));
  assert.equal(m.validateSupportSession({ ...base, score: "", max_score: "" }).score, null);
});
test("resource links reject executable protocols and embedded credentials", async () => {
  const [m] = await modules;
  for (const url of ["javascript:alert(1)", "data:text/html,test", "http://school.test", "https://user:secret@school.test"]) assert.throws(() => m.resourceUrl(url), /HTTPS/);
  assert.equal(m.resourceUrl("https://school.test/lesson"), "https://school.test/lesson");
});
test("tutor selection excludes primary teachers, co-teachers and advisers", async () => {
  const [m] = await modules;
  const assignment = { section_id: ids.section, teacher_id: ids.other, co_teacher_ids: [ids.teacher] };
  assert.equal(m.sameTutorClass(ids.other, ids.section, [assignment], []), true);
  assert.equal(m.sameTutorClass(ids.teacher, ids.section, [assignment], []), true);
  assert.equal(m.sameTutorClass(ids.teacher, ids.section, [], [{ teacher_id: ids.teacher, section_id: ids.section }]), true);
  assert.equal(m.sameTutorClass(ids.student, ids.section, [assignment], []), false);
});
test("progress CSV preserves text and neutralizes spreadsheet formulas", async () => {
  const [m] = await modules;
  assert.equal(m.csvCell('Quoted "feedback"'), '"Quoted ""feedback"""');
  for (const value of ["=1+1", " +formula", "@SUM(A1)", "\t=cmd", "\n-HYPERLINK"]) assert.ok(m.csvCell(value).startsWith("\"'"));
  assert.equal(m.csvCell(null), '""');
});
test("Word export is a real OOXML ZIP with safe Unicode text and all ILAW sections", async () => {
  const [,m] = await modules;
  const c = content(); c.title = 'ILAW <script> & "aralin"'; c.sessions[0].ways_forward = "Pag-uswag: café → pagkatuto";
  const bytes = Buffer.from(m.createIlawDocx(c, "Teacher <test>", "draft"));
  assert.equal(bytes.readUInt32LE(0), 0x04034b50);
  const entries = {};
  for (let offset = 0; bytes.readUInt32LE(offset) === 0x04034b50;) {
    const size = bytes.readUInt32LE(offset + 18), n = bytes.readUInt16LE(offset + 26), extra = bytes.readUInt16LE(offset + 28);
    const name = bytes.subarray(offset + 30, offset + 30 + n).toString("utf8"), start = offset + 30 + n + extra;
    entries[name] = bytes.subarray(start, start + size).toString("utf8");
    offset = start + size;
  }
  assert.ok(entries["[Content_Types].xml"].includes("wordprocessingml.document.main+xml"));
  assert.ok(entries["word/document.xml"].includes("ILAW &lt;script&gt; &amp; &quot;aralin&quot;"));
  assert.ok(entries["word/document.xml"].includes("café → pagkatuto"));
  assert.ok(!entries["word/document.xml"].includes("<script>"));
  for (const heading of ["Intentions", "Learning Experiences", "Assessment", "Ways Forward"]) assert.ok(entries["word/document.xml"].includes(heading));
  assert.ok(entries["word/styles.xml"].includes("Heading2"));
  assert.equal(Object.keys(entries).length, 5);
});
test("learning navigation exposes ILAW only to teaching personnel and ARAL only to participants", async () => {
  const [,,m] = await modules;
  const menu = role => m.portalNavigation({ role, permissions: [], isAdviser: false, hasPersonnelProfile: false, gradeLevelHead: null }).flatMap(g => g.items);
  assert.ok(menu("teacher").some(i => i.id === "ilaw"));
  assert.ok(menu("administrator").some(i => i.id === "ilaw"));
  assert.ok(!menu("student").some(i => i.id === "ilaw"));
  assert.ok(menu("student").some(i => i.id === "aral-support"));
  assert.ok(!menu("staff_administrator").some(i => ["ilaw", "aral-support"].includes(i.id)));
  for (const role of ["student", "teacher", "administrator"]) assert.equal(new Set(menu(role).map(i => i.href)).size, menu(role).length);
});
test("students cannot read or create teacher lesson plans", async () => {
  const r = await route("app/api/ilaw/route.ts", "student");
  assert.equal((await r.GET(r.request())).status, 403);
  assert.equal((await r.POST(r.request({ content: content(), owner_id: ids.teacher }))).status, 403);
  assert.ok(!r.calls.some(c => c.url.pathname.includes("ilaw_lesson_plans")));
});
test("learning APIs reject incomplete first-login setup before reading records", async () => {
  const r = await route("app/api/aral/route.ts", "teacher");
  r.profile.must_change_password = true;
  const response = await r.GET(r.request());
  assert.equal(response.status, 403);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.ok(!r.calls.some(c => c.url.pathname.includes("aral_support")));
});
test("ILAW creation uses the signed-in owner's identity and requires review for ready plans", async () => {
  const r = await route("app/api/ilaw/route.ts", "teacher", ({ method, body }) => method === "POST" ? [{ id: ids.plan, ...body }] : []);
  const ready = await r.POST(r.request({ content: content(), status: "ready", teacher_reviewed: false }));
  assert.equal(ready.status, 400);
  assert.ok(!r.calls.some(c => c.method === "POST"));
  const draft = await r.POST(r.request({ content: content(), owner_id: ids.other, status: "draft" }));
  assert.equal(draft.status, 201);
  const write = r.calls.find(c => c.method === "POST");
  assert.equal(write.body.owner_id, ids.teacher);
  assert.equal(write.headers.apikey, "publishable-test-key");
});
test("ILAW stale saves report a conflict instead of overwriting or inserting", async () => {
  const r = await route("app/api/ilaw/route.ts", "teacher");
  const response = await r.POST(r.request({ id: ids.plan, expected_updated_at: "2026-11-24T00:00:00Z", content: content(), status: "draft" }));
  assert.equal(response.status, 409);
  assert.ok(r.calls.some(c => c.method === "PATCH" && c.url.searchParams.has("updated_at")));
  assert.ok(!r.calls.some(c => c.method === "POST"));
});
test("teachers cannot assign themselves learners and learners cannot record attendance or scores", async () => {
  const teacher = await route("app/api/aral/route.ts", "teacher");
  assert.equal((await teacher.POST(teacher.request({ action: "plan", plan: {} }))).status, 403);
  const student = await route("app/api/aral/route.ts", "student");
  assert.equal((await student.POST(student.request({ action: "session", session: {} }))).status, 403);
  for (const r of [teacher, student]) assert.ok(!r.calls.some(c => ["POST", "PATCH"].includes(c.method)));
});
test("a tutor cannot write another tutor's session even if a record were returned incorrectly", async () => {
  const r = await route("app/api/aral/route.ts", "teacher", ({ url }) => url.pathname.endsWith("aral_support_plans") ? [{ id: ids.plan, tutor_id: ids.other, student_id: ids.student, status: "active" }] : []);
  const response = await r.POST(r.request({ action: "session", session: { plan_id: ids.plan, session_date: "2026-11-24", activity: "Reading practice", attendance: "scheduled" } }));
  assert.equal(response.status, 403);
  assert.ok(!r.calls.some(c => c.method === "POST" || c.method === "PATCH"));
});
test("learner responses bind the learner identity and never persist forged score fields", async () => {
  const r = await route("app/api/aral/route.ts", "student", ({ url, method, body }) => {
    if (url.pathname.endsWith("aral_support_sessions")) return [{ id: ids.session, plan_id: ids.plan }];
    if (url.pathname.endsWith("aral_support_plans")) return [{ id: ids.plan, student_id: ids.student, tutor_id: ids.teacher, status: "active" }];
    return method === "POST" ? [body] : [];
  });
  const response = await r.POST(r.request({ action: "response", session_id: ids.session, student_id: ids.other, message: "Please explain step two.", completed: false, needs_help: true, score: 100, attendance: "present" }));
  assert.equal(response.status, 200);
  const write = r.calls.find(c => c.method === "POST");
  assert.equal(write.body.student_id, ids.student);
  assert.equal(write.body.needs_help, true);
  assert.ok(!("score" in write.body));
  assert.ok(!("attendance" in write.body));
});

