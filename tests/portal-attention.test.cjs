const test = require("node:test");
const assert = require("node:assert/strict");
const { pathToFileURL } = require("node:url");
const path = require("node:path");
const lib = import(pathToFileURL(path.join(__dirname, "../lib/portal-attention.ts")).href);
const empty = () => ({ personnel: null, adviser: null, error: false });
const scope = (role = "teacher", isAdviser = false) => ({ role, isAdviser });
const personnel = (missing = ["Mobile number", "Address"]) => ({
  self: { personnel_type: "teaching", missing_fields: missing, complete: !missing.length },
  can_manage: false, teaching_count: 0, non_teaching_count: 0, total_incomplete: 0,
  incomplete_teaching: [], incomplete_non_teaching: [],
});
const alert = (id = "learner-details", href = "/portal/academic/advisory") => ({
  id, severity: "warning", title: "Update learner details", detail: "Two learner records need information.", count: 2, href,
  actionLabel: "Review learners", administratorAction: false,
});

test("profile reminders clear only after the required information is complete", async () => {
  const { buildPortalNotifications, featureAttentionCount } = await lib;
  const data = { ...empty(), personnel: personnel() };
  const links = ["/portal/teacher-profile"];
  const items = buildPortalNotifications(scope(), data, 0, links);
  assert.equal(items.length, 1);
  assert.equal(items[0].href, links[0]);
  assert.equal(featureAttentionCount(items, "personnel-profile"), 2);
  assert.deepEqual(buildPortalNotifications(scope(), { ...data, personnel: personnel([]) }, 0, links), []);
});

test("students never receive personnel or adviser reminders even if stale payloads exist", async () => {
  const { buildPortalNotifications } = await lib;
  const data = { ...empty(), personnel: { ...personnel(), can_manage: true, teaching_count: 4 }, adviser: { alerts: [alert()], totalAlertTypes: 1 } };
  const items = buildPortalNotifications(scope("student", true), data, 3, ["/portal/teacher-profile", "/portal/admin/teacher-profiles", "/portal/community"]);
  assert.deepEqual(items.map(item => item.kind), ["message"]);
  assert.equal(items[0].count, 3);
});

test("adviser reminders use real alerts, deduplicate ids, and never open external destinations", async () => {
  const { buildPortalNotifications, safePortalHref } = await lib;
  const data = { ...empty(), adviser: { alerts: [alert(), alert(), alert("unsafe", "https://example.invalid"), { ...alert("admin", null), administratorAction: true }], totalAlertTypes: 4 } };
  assert.deepEqual(buildPortalNotifications(scope(), data, 0, []), []);
  const items = buildPortalNotifications(scope("teacher", true), data, 0, []);
  assert.equal(items.length, 3);
  assert.equal(items[0].href, "/portal/academic/advisory");
  assert.equal(items[1].href, null);
  assert.equal(items[2].href, null);
  for (const href of ["//example.invalid/portal", "javascript:alert(1)", "/portal/../../outside", "/portal\\\\example.invalid"]) assert.equal(safePortalHref(href), null);
  assert.equal(safePortalHref("/portal/learners?section=7#details"), "/portal/learners?section=7#details");
});

test("personnel manager reminders require both server permissions and accessible navigation", async () => {
  const { buildPortalNotifications } = await lib;
  const data = { ...empty(), personnel: { ...personnel([]), can_manage: true, teaching_count: 8, non_teaching_count: 2 } };
  assert.deepEqual(buildPortalNotifications(scope("staff_administrator"), data, 0, []), []);
  const links = ["/portal/admin/teacher-profiles", "/portal/admin/non-teaching-profiles"];
  assert.deepEqual(buildPortalNotifications(scope("staff_administrator"), data, 0, links).map(item => item.count), [8, 2]);
  data.personnel.can_manage = false;
  assert.deepEqual(buildPortalNotifications(scope("staff_administrator"), data, 0, links), []);
});

test("each role loads only its own applicable attention endpoints", async () => {
  const { fetchPortalAttention } = await lib;
  for (const [role, isAdviser, expected] of [["student", false, 0], ["teacher", false, 1], ["teacher", true, 2], ["staff_administrator", false, 1], ["administrator", false, 1]]) {
    const calls = [];
    const result = await fetchPortalAttention(scope(role, isAdviser), empty(), async (url, init) => {
      calls.push(url); assert.equal(init.cache, "no-store");
      if (url.includes("teacher-profiles")) { assert.equal(init.method, "POST"); assert.deepEqual(JSON.parse(init.body), { action: "profile_attention" }); return Response.json(personnel()); }
      return Response.json({ alerts: [alert()], totalAlertTypes: 1 });
    });
    assert.equal(calls.length, expected);
    assert.equal(result.error, false);
  }
});

test("expired attention requests refresh the session once and retry only unauthorized requests", async () => {
  const { fetchPortalAttention } = await lib;
  const calls = [];
  const result = await fetchPortalAttention(scope("teacher", true), empty(), async url => {
    calls.push(url);
    if (url === "/api/auth/me") return Response.json({ profile: {} });
    if (calls.filter(value => value === url).length === 1) return new Response(null, { status: 401 });
    return Response.json(url.includes("teacher-profiles") ? personnel() : { alerts: [alert()], totalAlertTypes: 1 });
  });
  assert.equal(calls.filter(url => url === "/api/auth/me").length, 1);
  assert.equal(calls.length, 5);
  assert.equal(result.error, false);
  assert.equal(result.adviser.alerts.length, 1);
});

test("partial failures preserve known reminders while successful sources update", async () => {
  const { fetchPortalAttention } = await lib;
  const previous = { ...empty(), personnel: personnel(), adviser: { alerts: [alert()], totalAlertTypes: 1 } };
  const result = await fetchPortalAttention(scope("teacher", true), previous, async url => url.includes("teacher-profiles")
    ? Response.json(personnel([])) : new Response(null, { status: 503 }));
  assert.equal(result.error, true);
  assert.equal(result.personnel.self.complete, true);
  assert.equal(result.adviser, previous.adviser);
});

test("denied sources discard old reminders and losing adviser status clears advisory data", async () => {
  const { fetchPortalAttention } = await lib;
  const previous = { ...empty(), personnel: personnel(), adviser: { alerts: [alert()], totalAlertTypes: 1 } };
  const denied = await fetchPortalAttention(scope("teacher", true), previous, async () => new Response(null, { status: 403 }));
  assert.equal(denied.personnel, null); assert.equal(denied.adviser, null); assert.equal(denied.error, true);
  const regular = await fetchPortalAttention(scope(), previous, async () => Response.json(personnel()));
  assert.equal(regular.adviser, null);
  const student = await fetchPortalAttention(scope("student"), previous, async () => { throw new Error("No fetch allowed"); });
  assert.deepEqual(student, empty());
});

test("invalid responses retain the last known state and report an error", async () => {
  const { fetchPortalAttention } = await lib;
  const previous = { ...empty(), personnel: personnel() };
  const result = await fetchPortalAttention(scope(), previous, async () => Response.json({ error: "unexpected" }));
  assert.equal(result.personnel, previous.personnel);
  assert.equal(result.error, true);
});
