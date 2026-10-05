const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function loadTS(file, overrides = {}) {
  const mod = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, {
    module: mod, exports: mod.exports, console, Response,
    fetch: overrides.fetch,
    require(name) {
      if (overrides[name]) return overrides[name];
      if (name === '@/lib/schedule-conflicts') return matcher;
      return require(name);
    },
  });
  return mod.exports;
}
const matcher = loadTS('lib/schedule-conflicts.ts');
const target = { id:'a', teacher_id:'teacher-a', section_id:'section-a', subject_id:'math', grade_level:8, major:null };
const other = { id:'b', teacher_id:'teacher-b', section_id:'section-b', subject_id:'science', grade_level:8, major:null };
const period = { day_of_week:1, start_time:'08:00', end_time:'09:00', room:'Room 1' };
const schedule = { ...period, id:'existing', teacher_assignment_id:'b', start_time:'08:30:00', end_time:'09:30:00', is_active:true };
function data(assignment = other, entry = schedule) {
  return { assignments:[target,assignment], schedules:[entry], teachers:[{id:assignment.teacher_id,full_name:'Existing Teacher'}], sections:[{id:assignment.section_id,name:'Apitong'}], subjects:[{id:assignment.subject_id,name:'Science'}] };
}
function match(assignment=other, entry=schedule, proposed=period, source=target) {
  return matcher.findScheduleConflicts(source,[proposed],data(assignment,entry));
}

test('separate teacher, section and room conflicts identify the actual overlapping class', () => {
  assert.deepEqual(Array.from(match({...other,teacher_id:target.teacher_id},{...schedule,room:'Other'})[0].kinds), ['teacher']);
  assert.deepEqual(Array.from(match({...other,section_id:target.section_id},{...schedule,room:'Other'})[0].kinds), ['section']);
  const room = match()[0];
  assert.deepEqual(Array.from(room.kinds), ['room']);
  assert.equal(room.teacherName,'Existing Teacher');
  assert.equal(room.sectionName,'Apitong');
  assert.equal(room.subjectName,'Science');
  assert.equal(room.schedule.id,'existing');
});
test('combined conflicts produce one record with all matching reasons', () => {
  const results = match({...other,teacher_id:target.teacher_id,section_id:target.section_id});
  assert.equal(results.length,1);
  assert.deepEqual(Array.from(results[0].kinds), ['teacher','section','room']);
});
test('adjacent times, other days, inactive entries, and editing the same row are allowed', () => {
  assert.equal(match(other,{...schedule,start_time:'09:00:00'}).length,0);
  assert.equal(match(other,{...schedule,end_time:'08:00:00',start_time:'07:00:00'}).length,0);
  assert.equal(match(other,{...schedule,day_of_week:2}).length,0);
  assert.equal(match(other,{...schedule,is_active:false}).length,0);
  assert.equal(match(other,schedule,{...period,id:'existing'}).length,0);
});
test('missing rooms do not conflict and room names match case-insensitively', () => {
  assert.equal(match(other,{...schedule,room:null},{...period,room:null}).length,0);
  assert.equal(match(other,{...schedule,room:' ROOM 1 '}).length,1);
});
test('different TVE majors allow parallel sections but still check teacher and room', () => {
  const source = {...target,subject_id:'tve',major:'Animal Production - Swine'};
  const parallel = {...other,subject_id:'tve',section_id:target.section_id,major:'Animal Production - Poultry'};
  assert.equal(match(parallel,{...schedule,room:'Other'},period,source).length,0);
  assert.deepEqual(Array.from(match(parallel,schedule,period,source)[0].kinds),['room']);
  assert.deepEqual(Array.from(match({...parallel,teacher_id:target.teacher_id},{...schedule,room:'Other'},period,source)[0].kinds),['teacher']);
  assert.equal(match({...parallel,major:source.major},{...schedule,room:'Other'},period,source).length,1);
});
test('all selected days are checked and missing active assignments are excluded', () => {
  const results = matcher.findScheduleConflicts(target,[{...period,day_of_week:3},period],data());
  assert.equal(results.length,1);
  assert.equal(matcher.findScheduleConflicts(target,[period],{...data(),assignments:[target]}).length,0);
});

function route(allowed = true) {
  const writes=[];
  const api = loadTS('app/api/admin/class-schedules/route.ts', {
    '@/lib/admin-access':{hasAdminPermission:async()=>allowed},
    '@/lib/supabase-config':{SUPABASE_URL:'https://test.invalid',SUPABASE_PUBLISHABLE_KEY:'test'},
    fetch:async (url,options={})=> {
      const u = new URL(url);
      const response=(body,status=200)=>new Response(JSON.stringify(body),{status});
      if(u.pathname==='/auth/v1/user')return response({id:'admin'});
      if(u.pathname.endsWith('/school_years'))return response([{id:'year',name:'2026-2027'}]);
      if(u.pathname.endsWith('/teacher_assignments'))return response(u.searchParams.has('id') ? [{...target,school_year_id:'year'}] : [target,other]);
      if(u.pathname.endsWith('/profiles'))return response([{id:other.teacher_id,full_name:'Existing Teacher'}]);
      if(u.pathname.endsWith('/sections'))return response([{id:other.section_id,name:'Apitong'}]);
      if(u.pathname.endsWith('/subjects'))return response([{id:other.subject_id,name:'Science'}]);
      if(u.pathname.endsWith('/class_schedules')) {
        if(options.method){writes.push(options);return response({message:'schedule conflicts with an existing room schedule'},400);}
        if(u.searchParams.has('id'))return response([{...period,id:'reactivate',teacher_assignment_id:'a'}]);
        return response([schedule]);
      }
      throw new Error('Unexpected fetch: '+url);
    },
  });
  return {api,writes};
}
function request(body,token='test') {
  return { cookies:{get:()=>token?{value:token}:undefined}, json:async()=>body };
}
test('server reports fresh conflict details when database rejects a save', async () => {
  const {api,writes}=route();
  const response=await api.POST(request({action:'save_schedule',assignmentId:'a',entries:[{dayOfWeek:1,startTime:'08:00',endTime:'09:00',room:'Room 1'}]}));
  const result=await response.json();
  assert.equal(response.status,409);
  assert.equal(result.code,'schedule_conflict');
  assert.equal(result.conflicts[0].schedule.id,'existing');
  assert.equal(result.conflicts[0].teacherName,'Existing Teacher');
  assert.equal(writes.length,1);
});
test('reactivation uses the same structured conflict response', async () => {
  const {api}=route();
  const response=await api.POST(request({action:'set_schedule_active',id:'reactivate',isActive:true}));
  assert.equal(response.status,409);
  assert.equal((await response.json()).conflicts[0].schedule.id,'existing');
});
test('unauthorized users cannot obtain conflict details or write schedules', async () => {
  for(const token of ['', 'test']) {
    const {api,writes}=route(false);
    const response=await api.POST(request({action:'save_schedule',assignmentId:'a'},token));
    assert.equal(response.status,403);assert.equal(writes.length,0);
  }
});
