const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

const source = fs.readFileSync(
  path.join(__dirname, "../lib/portal-navigation.ts"),
  "utf8",
);
const mod = { exports: {} };
vm.runInNewContext(
  ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText,
  { module: mod, exports: mod.exports, URLSearchParams },
);
const { portalNavigation, activePortalFeature, searchPortalFeatures } =
  mod.exports;
const access = (role, extra = {}) => ({
  role,
  permissions: [],
  isAdviser: false,
  hasPersonnelProfile: false,
  gradeLevelHead: null,
  ...extra,
});
const items = (scope) =>
  portalNavigation(scope).flatMap((group) => group.items);
const ids = (scope) => Array.from(items(scope).map((item) => item.id));

test("students keep their academic tools and never receive staff or administration destinations", () => {
  const features = items(access("student"));
  for (const id of [
    "grades",
    "attendance",
    "schedule",
    "announcements",
    "resources",
    "community",
    "profile",
  ])
    assert.ok(features.some((item) => item.id === id));
  assert.ok(
    features.every(
      (item) =>
        !item.href.includes("/admin/") &&
        !item.href.includes("service-credits") &&
        !item.href.includes("/sf"),
    ),
  );
});

test("subject teachers retain published grades while adviser-only tasks remain hidden", () => {
  const ordinary = ids(access("teacher"));
  for (const id of [
    "grades",
    "learners",
    "assignments",
    "schedule",
    "my-credits",
    "personnel-profile",
  ])
    assert.ok(ordinary.includes(id));
  for (const id of ["advisory", "attendance", "sf2", "sf9", "sf10"])
    assert.ok(!ordinary.includes(id));
  const adviser = items(access("teacher", { isAdviser: true }));
  for (const id of ["advisory", "attendance", "sf2", "sf9", "sf10"])
    assert.ok(adviser.some((item) => item.id === id));
  assert.equal(adviser.find((item) => item.id === "sf10").href, "/portal/sf10");
});

test("grade level heads receive only their existing scoped management tools", () => {
  const head = items(access("teacher", { gradeLevelHead: 11 }));
  assert.equal(
    head.find((item) => item.id === "school-attendance").label,
    "Grade 11 Attendance",
  );
  assert.deepEqual(
    Array.from(
      head
        .filter((item) => item.href.startsWith("/portal/admin/"))
        .map((item) => item.id),
    ).sort(),
    ["reports", "schedules", "school-attendance"],
  );
  assert.ok(!head.some((item) => item.id === "sf9"));
});

test("delegated staff menus follow individual grants without exposing full administrator tools", () => {
  const empty = ids(access("staff_administrator"));
  assert.deepEqual(empty, ["home", "community", "profile", "my-credits"]);
  const hr = ids(
    access("staff_administrator", {
      permissions: ["hr.manage"],
      hasPersonnelProfile: true,
    }),
  );
  for (const id of [
    "teachers",
    "non-teaching",
    "designations",
    "credits",
    "personnel-profile",
  ])
    assert.ok(hr.includes(id));
  for (const id of [
    "learners",
    "sf9",
    "teacher-import",
    "administrators",
    "schedules",
  ])
    assert.ok(!hr.includes(id));
  const registrar = items(
    access("staff_administrator", {
      permissions: ["sf10.manage", "reports.view"],
    }),
  );
  assert.equal(
    registrar.find((item) => item.id === "sf10").href,
    "/portal/admin/sf10",
  );
  assert.ok(registrar.some((item) => item.id === "sf2"));
  assert.ok(!registrar.some((item) => item.id === "sf9"));
});

test("all role menus have unique destinations and links to real portal pages", () => {
  const permissions = [
    "users.manage",
    "bulk_import.manage",
    "teaching.manage",
    "schedules.manage",
    "attendance.manage",
    "reports.view",
    "announcements.manage",
    "resources.manage",
    "password_resets.manage",
    "sf10.manage",
    "hr.manage",
    "school_setup.manage",
  ];
  const scopes = [
    access("student"),
    access("teacher"),
    access("teacher", { isAdviser: true, gradeLevelHead: 12 }),
    access("administrator"),
    access("staff_administrator", { permissions }),
  ];
  for (const scope of scopes) {
    const features = items(scope);
    assert.equal(
      new Set(features.map((item) => item.id)).size,
      features.length,
    );
    assert.equal(
      new Set(features.map((item) => item.href)).size,
      features.length,
    );
    for (const feature of features) {
      assert.ok(
        fs.existsSync(
          path.join(
            __dirname,
            "../app",
            feature.href.split("?")[0],
            "page.tsx",
          ),
        ),
        feature.href,
      );
    }
  }
});

test("route highlighting understands dashboard views and schedule filters", () => {
  const teacher = portalNavigation(access("teacher", { isAdviser: true }));
  assert.equal(
    activePortalFeature(teacher, "/portal", "open=schedule").item.id,
    "schedule",
  );
  assert.equal(
    activePortalFeature(teacher, "/portal", "open=assignments").item.id,
    "assignments",
  );
  assert.equal(
    activePortalFeature(teacher, "/portal", "reason=forbidden").item.id,
    "home",
  );
  assert.equal(
    activePortalFeature(teacher, "/portal/grades", "term=2").item.id,
    "grades",
  );
  assert.equal(
    activePortalFeature(
      portalNavigation(access("administrator")),
      "/portal/admin/schedules",
      "view=teacher",
    ).item.id,
    "schedules",
  );
});

test("search finds related tasks but can never return a feature outside the user's menu", () => {
  const admin = portalNavigation(access("administrator"));
  assert.equal(
    searchPortalFeatures(admin, "report cards")[0].items[0].id,
    "sf9",
  );
  assert.ok(
    searchPortalFeatures(admin, "teacher schedule")
      .flatMap((group) => group.items)
      .some((item) => item.id === "schedules"),
  );
  assert.ok(
    searchPortalFeatures(admin, "wellness")
      .flatMap((group) => group.items)
      .some((item) => item.id === "credits"),
  );
  assert.equal(
    searchPortalFeatures(portalNavigation(access("student")), "wellness")
      .length,
    0,
  );
  assert.equal(
    searchPortalFeatures(portalNavigation(access("teacher")), "report cards")
      .length,
    0,
  );
  assert.equal(searchPortalFeatures(admin, "not-a-real-feature").length, 0);
});
