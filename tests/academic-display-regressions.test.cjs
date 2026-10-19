const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.join(__dirname, '..');
function load(file, fetcher, extra = {}) {
  const mod = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, {
    module: mod, exports: mod.exports, console, Response, URLSearchParams, fetch: fetcher,
    ...extra,
    require(name) {
      if (name === 'next/server') return { NextResponse: { json: (body, options) => Response.json(body, options) } };
      if (name === '@/lib/supabase-config') return { SUPABASE_URL: 'https://test.example', SUPABASE_PUBLISHABLE_KEY: 'public' };
      if (name.startsWith('@/')) return load(name.slice(2) + '.ts', fetcher, extra);
      if (name.startsWith('.')) return load(path.relative(root, path.resolve(root, path.dirname(file), name.replace(/\.ts$/, '') + '.ts')), fetcher, extra);
      return require(name);
    },
  }, { filename: file });
  return mod.exports;
}
const shared = load('supabase/functions/_shared/academic-visibility.ts');
const assignment = { id: 'assignment', grade_level: 11, teacher_id: 'teacher', section_id: 'section', subject_id: 'subject', major: 'STEM_MEDICAL' };
const enrollment = { student_id: 'student', grade_level: 11, section_id: 'section', tve_major: null, shs_elective_group: 'STEM_MEDICAL' };
const request = body => ({ cookies: { get: () => ({ value: 'token' }) }, json: async () => body });
const json = (body, status = 200) => Response.json(body, { status });

test('Grade 11 STEM and TVL use learner elective groups; JHS still uses TVE majors', () => {
  for (const major of ['STEM_MEDICAL', 'STEM_ENGINEERING', 'TVL_OAP', 'TVL_FOOD_PROCESSING']) {
    assert.equal(shared.matchesLearnerMajor({ grade_level: 11, major }, { tve_major: null, shs_elective_group: major }), true);
    assert.equal(shared.matchesLearnerMajor({ grade_level: 11, major }, { tve_major: major, shs_elective_group: null }), false);
  }
  assert.equal(shared.matchesLearnerMajor({ grade_level: 8, major: 'Food Processing' }, { tve_major: 'Food Processing' }), true);
  assert.equal(shared.matchesLearnerMajor({ grade_level: 11, major: null }, {}), true);
});
test('Grade 12 terms determine teacher visibility and preserve mixed-major roster restrictions', () => {
  const a = { ...assignment, grade_level: 12, major: null, teacher_id: 'term1' };
  const links = [
    { teacher_assignment_id: a.id, term_teacher_id: 'term1', term_no: 1, requires_learner_group: false },
    { teacher_assignment_id: a.id, term_teacher_id: 'term2', term_no: 2, requires_learner_group: true },
  ];
  assert.equal(shared.teacherCanSeeAssignment(a, links, 'term2'), true);
  assert.equal(shared.teacherCanReadRoster(a, links, 'term2'), false);
  assert.equal(shared.teacherCanReadRoster(a, links, 'term1'), true);
  assert.equal(shared.teacherCanSeeAssignment(a, [], 'term1'), false);
  assert.equal(shared.teacherCanSeeAssignment(a, links, 'unrelated'), false);
});
function gradesApi({ major = 'STEM_MEDICAL', students = [enrollment], grades = [], failure = '' } = {}) {
  const writes = [];
  const api = load('app/api/academic/grades/route.ts', async (url, options = {}) => {
    const u = new URL(url);
    if (options.method === 'PATCH') { writes.push(url); return json([{ id: 'grade' }]); }
    if (u.pathname.endsWith('/user')) return json({ id: 'teacher' });
    const table = u.pathname.split('/').pop();
    let rows = table === 'profiles' ? [{ id: 'teacher', role: 'teacher', account_status: 'active' }]
      : table === 'school_years' ? [{ id: 'year' }]
      : table === 'teacher_assignments' ? [{ ...assignment, major }]
      : table === 'section_advisers' ? [{ id: 'adviser', section_id: 'section' }]
      : table === 'subjects' ? [{ id: 'subject', name: 'Biology', is_graded: true }]
      : table === 'student_enrollments' ? students
      : table === 'student_term_grades' ? grades : [];
    if (failure === table) return json({ error: 'query failed' }, 500);
    const columns = u.searchParams.get('select')?.split(',');
    if (columns) rows = rows.map(row => Object.fromEntries(columns.filter(key => key in row).map(key => [key, row[key]])));
    return json(rows);
  });
  return { api, writes };
}
for (const major of ['STEM_MEDICAL', 'STEM_ENGINEERING', 'TVL_OAP', 'TVL_FOOD_PROCESSING']) {
  test(`publishing ${major} rejects missing eligible grades and ignores other groups`, async () => {
    const students = [{ ...enrollment, shs_elective_group: major }, { ...enrollment, student_id: 'other', shs_elective_group: 'OTHER' }];
    const bad = gradesApi({ major, students });
    const rejected = await bad.api.POST(request({ action: 'publish_term', assignmentId: assignment.id, termNo: 1 }));
    assert.equal(rejected.status, 409);
    assert.match((await rejected.json()).error, /Missing: 1/);
    assert.equal(bad.writes.length, 0);
    const good = gradesApi({ major, students, grades: [{ id: 'g', student_id: 'student', teacher_assignment_id: assignment.id, status: 'draft' }] });
    assert.equal((await good.api.POST(request({ action: 'publish_term', assignmentId: assignment.id, termNo: 1 }))).status, 200);
    assert.equal(good.writes.length, 1);
  });
}
test('publishing blocks empty groups and failed validation reads before writing', async () => {
  for (const options of [{ students: [{ ...enrollment, shs_elective_group: null }] }, { failure: 'student_enrollments' }, { failure: 'student_term_grades' }]) {
    const { api, writes } = gradesApi(options);
    const response = await api.POST(request({ action: 'publish_term', assignmentId: assignment.id, termNo: 1 }));
    assert.ok([409, 503].includes(response.status));
    assert.equal(writes.length, 0);
  }
});
function displayApi(role, { periods = [], links = [], failPeriods = false, many = false } = {}) {
  return async url => {
    const u = new URL(url); const table = u.pathname.split('/').pop();
    if (table === 'user') return json({ id: role === 'teacher' ? 'teacher' : 'student' });
    if (table === 'profiles') return json([{ id: 'teacher', role, full_name: 'Teacher', account_status: 'active' }]);
    if (table === 'school_years') return json([{ id: 'year', name: '2026-2027' }]);
    if (table === 'teacher_assignments') return json([assignment]);
    if (table === 'grade12_term_gradebook') return json(links);
    if (table === 'sections') return json([{ id: 'section', name: 'Amber' }]);
    if (table === 'subjects') return json([{ id: 'subject', name: 'Biology' }]);
    if (table === 'student_enrollments') {
      if (many && !u.searchParams.has('student_id')) return json(Number(u.searchParams.get('offset')) === 0 ? Array(1000).fill(enrollment) : [enrollment]);
      return json([enrollment]);
    }
    if (table === 'class_schedules') return json([{ id: 'schedule', teacher_assignment_id: assignment.id, day_of_week: 1, start_time: '08:00', end_time: '09:00' }]);
    if (table === 'grade12_term_periods') return failPeriods ? json({}, 500) : json(periods);
    return json([]);
  };
}
test('assignment counts include Grade 11 groups beyond the first 1000 enrollments', async () => {
  const api = load('app/api/academic/my-assignments/route.ts', displayApi('teacher', { many: true }));
  const response = await api.GET(request()); const data = await response.json();
  assert.equal(response.status, 200);
  assert.equal(data.assignments[0].student_count, 1001);
  assert.equal(data.assignments[0].pending_tve_major_count, 0);
});
test('student schedule includes Grade 11 electives and only their own Grade 12 section periods', async () => {
  const p = { id: 'p', section_id: 'section', term_no: 2, day_of_week: 1, start_time: '09:00', end_time: '10:00', subject_label: 'English', instructor_ids: ['teacher'] };
  const api = load('app/api/academic/my-schedule/route.ts', displayApi('student', { periods: [p, { ...p, id: 'other', section_id: 'other' }] }));
  const response = await api.GET(request()); const data = await response.json();
  assert.equal(response.status, 200);
  assert.equal(data.schedules.length, 2);
  assert.equal(data.schedules.find(e => e.id === 'g12-term-p').term_no, 2);
  assert.ok(!data.schedules.some(e => e.id === 'g12-term-other'));
});
test('schedule source failure is reported instead of silently hiding Grade 12 entries', async () => {
  const api = load('app/api/academic/my-schedule/route.ts', displayApi('teacher', { failPeriods: true }));
  assert.equal((await api.GET(request())).status, 503);
});
test('term conflicts respect year, term, section, teacher, adjacency and parallel TVL majors', () => {
  const { termPeriodConflicts } = load('lib/term-schedule-conflicts.ts');
  const p = { id: 'p', school_year_id: 'year', section_id: 'a', term_no: 1, day_of_week: 1, start_time: '08:00', end_time: '09:00', subject_label: 'Math', instructor_ids: ['teacher'] };
  const match = changes => termPeriodConflicts(p, [{ ...p, id: 'q', ...changes }]).length;
  assert.equal(match({ section_id: 'b' }), 1);
  assert.equal(match({ instructor_ids: ['other'] }), 1);
  assert.equal(match({ school_year_id: 'old' }), 0);
  assert.equal(match({ term_no: 2 }), 0);
  assert.equal(match({ start_time: '09:00' }), 0);
  assert.equal(termPeriodConflicts({ ...p, subject_label: 'FOOD PROCESSING' }, [{ ...p, id: 'q', subject_label: 'ORGANIC AGRICULTURE PRODUCTION', instructor_ids: ['other'] }]).length, 0);
});
test('ALS labels distinguish grade zero from missing grade', () => {
  const { gradeLabel } = load('lib/grade-label.ts');
  assert.equal(gradeLabel(0), 'ALS A&E');
  assert.equal(gradeLabel(7), 'Grade 7');
  assert.equal(gradeLabel(null), '');
});
