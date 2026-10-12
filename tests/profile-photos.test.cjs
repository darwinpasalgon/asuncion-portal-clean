const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

function read(file) {
  return fs.readFileSync(path.join(__dirname, "..", file), "utf8");
}

test("profile photos use a private restricted Storage bucket", () => {
  const sql = read("supabase/migrations/20261012094530_profile_display_photos.sql");
  assert.match(sql, /'profile-photos'/);
  assert.match(sql, /false,\s*2097152/s);
  assert.match(sql, /image\/jpeg/);
  assert.match(sql, /image\/png/);
  assert.match(sql, /image\/webp/);
  assert.match(sql, /Users upload own profile photos/);
  assert.match(sql, /split_part\(name, '\/', 1\).*auth\.uid/s);
  assert.match(sql, /private\.is_super_admin\(\)/);
});

test("profile photo metadata is owner-scoped and private", () => {
  const sql = read("supabase/migrations/20261012094530_profile_display_photos.sql");
  assert.match(sql, /create table if not exists public\.profile_photos/);
  assert.match(sql, /object_path like user_id::text \|\| '\/%'/);
  assert.match(sql, /alter table public\.profile_photos enable row level security/);
  assert.match(sql, /Users insert own profile photo metadata/);
  assert.match(sql, /Users update own profile photo metadata/);
});

test("profile photo API validates uploads and supports super admin removal", () => {
  const api = read("app/api/profile-photo/route.ts");
  assert.match(api, /MAX_FILE_SIZE = 2 \* 1024 \* 1024/);
  assert.match(api, /image\/jpeg/);
  assert.match(api, /image\/png/);
  assert.match(api, /image\/webp/);
  assert.match(api, /storage\/v1\/object\/authenticated\/profile-photos/);
  assert.match(api, /auth\.profile\.role !== "administrator"/);
});

test("My Profile automatically crops and compresses display photos", () => {
  const page = read("app/portal/profile/page.tsx");
  assert.match(page, /cropAndCompress/);
  assert.match(page, /canvas\.width = 512/);
  assert.match(page, /canvas\.height = 512/);
  assert.match(page, /image\/webp/);
  assert.match(page, /Replace Photo/);
  assert.match(page, /Remove Photo/);
  assert.match(page, /Visible only inside the signed-in ANHS portal/);
});

test("portal and Community use uploaded profile photos with initials fallback", () => {
  const portal = read("app/portal/page.tsx");
  const community = read("app/portal/community/page.tsx");
  const avatar = read("components/profile-avatar.tsx");

  assert.match(portal, /href = "\/portal\/profile"|window\.location\.href = "\/portal\/profile"/);
  assert.match(portal, /<ProfileAvatar/);
  assert.match(community, /<ProfileAvatar/);
  assert.match(community, /Remove Photo/);
  assert.match(avatar, /onError=\{\(\) => setFailed\(true\)\}/);
  assert.match(avatar, /initials\(name\)/);
});
