const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, overrides = {}) {
  const mod = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, {
    module: mod, exports: mod.exports, Response, console: { error() {} },
    fetch: overrides.fetch,
    require(name) { return overrides[name] || require(name); },
  });
  return mod.exports;
}
const errors = load('lib/teaching-assignment-error.ts');
const subjectConfig = load('lib/subject-config.ts');
const majors = ['Animal Production - Poultry', 'Animal Production - Swine'];
function fixture(options = {}) {
  const writes = [];
  const fetch = async (url, init = {}) => {
    const u = new URL(url);
    const table = u.pathname.split('/').pop();
    if (init.method && init.method !== 'GET') {
      writes.push({ table, body: JSON.parse(init.body) });
      if (options.writeError) return Response.json(options.writeError, { status: 400 });
      return Response.json([{ id: 'assignment' }]);
    }
    if (table === 'user') return Response.json({ id: 'admin' });
    if (table === 'school_years') return Response.json([{ id: 'year' }]);
    if (table === 'sections') return Response.json([{ id: 'section', name: 'Narra' }]);
    if (table === 'subjects') return Response.json([{ id: 'subject', name: 'Technical Vocational Education', grade_level: 8 }]);
    if (table === 'profiles') return Response.json([{ id: 'teacher', role: 'teacher', account_status: 'active' }]);
    if (table === 'teacher_assignments' && options.lookupError) return Response.json({}, { status: 503 });
    if (table === 'teacher_assignments' && options.existing) return Response.json([{ id: 'assignment', subject_id: 'subject', teacher_id: 'teacher', major: majors[0], is_active: true }]);
    return Response.json([]);
  };
  const route = load('app/api/admin/teaching-setup/route.ts', {
    fetch,
    'next/server': { NextResponse: { json: Response.json } },
    '@/lib/admin-access': { hasAdminPermission: async () => options.allowed !== false },
    '@/lib/supabase-config': { SUPABASE_URL: 'https://example.test', SUPABASE_PUBLISHABLE_KEY: 'public' },
    '@/lib/subject-config': subjectConfig,
    '@/lib/teaching-assignment-error': errors,
  });
  const send = (body) => route.POST({ cookies: { get: () => ({ value: 'test-session' }) }, json: async () => body });
  return { writes, send };
}
function body(action, major = majors[0]) {
  return { action, gradeLevel: 8, sectionId: 'section', subjectId: 'subject', teacherId: 'teacher', major,
    assignments: [{ subjectId: 'subject', teacherId: 'teacher', major }] };
}
for (const action of ['assign_teacher', 'save_section_setup']) {
  test(`${action}: failed lookup stops assignment and adviser writes`, async () => {
    const f = fixture({ lookupError: true });
    const response = await f.send({ ...body(action), adviserTeacherId: 'teacher' });
    assert.equal(response.status, 503);
    assert.equal(f.writes.length, 0);
  });
  test(`${action}: permission denial never writes`, async () => {
    const f = fixture({ allowed: false });
    assert.equal((await f.send(body(action))).status, 403);
    assert.equal(f.writes.length, 0);
  });
  for (const major of majors) test(`${action}: saves ${major}`, async () => {
    const f = fixture();
    assert.equal((await f.send(body(action, major))).status, 200);
    assert.equal(f.writes[0].body.major, major);
  });
  test(`${action}: rejected TVE major identifies subject and next step`, async () => {
    const f = fixture({ writeError: { code: '23514', message: 'violates teacher_assignments_major_check', details: 'PRIVATE ROW DATA' } });
    const response = await f.send(body(action));
    assert.equal(response.status, 400);
    const result = await response.json();
    assert.match(result.error, /Technical Vocational Education/);
    assert.match(result.error, /Animal Production - Poultry/);
    assert.match(result.error, /TVE Major list/);
    assert.doesNotMatch(result.error, /PRIVATE ROW DATA|teacher_assignments_major_check/);
  });
}
test('failed existing-assignment update returns actionable error', async () => {
  const f = fixture({ existing: true, writeError: { code: 'P0001', message: 'teacher must be an active teacher account' } });
  const response = await f.send(body('assign_teacher'));
  assert.match((await response.json()).error, /needs an active Teacher account/);
});
test('unknown database errors do not expose internal details', () => {
  assert.doesNotMatch(errors.teachingAssignmentError({ code: 'XX000', message: 'private account data' }, 'English', null).error, /private account data/);
});
