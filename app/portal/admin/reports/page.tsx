"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Download,
  GraduationCap,
  Printer,
  RefreshCw,
  TriangleAlert,
  Users,
} from "lucide-react";
import styles from "./reports.module.css";

type GradeLevel={grade_level:number;label:string};
type Section={id:string;grade_level:number;name:string;is_active:boolean};
type Subject={id:string;grade_level:number;name:string;code:string|null;is_active:boolean};
type Teacher={id:string;full_name:string;email:string};
type Assignment={id:string;teacher_id:string;grade_level:number;section_id:string;subject_id:string;is_active:boolean};
type Student={
  student_id:string;
  full_name:string;
  lrn:string|null;
  grade_level:number|null;
  section_id:string|null;
  section_name:string|null;
};
type GradeRow={
  student_id:string;
  full_name:string;
  lrn:string|null;
  grade_level:number;
  section_id:string;
  section_name:string;
  assignment_id:string;
  subject_id:string;
  subject_name:string;
  subject_code:string|null;
  teacher_id:string;
  teacher_name:string;
  term1:number|null;
  term2:number|null;
  term3:number|null;
  final_grade:number|null;
  final_remark:"Passed"|"Failed"|null;
};
type AttendanceRow=Student&{
  present:number;
  absent:number;
  late:number;
  excused:number;
  total:number;
  attendance_rate:number|null;
};
type Counts={
  enrolled_students:number;
  active_assignments:number;
  published_term_grades:number;
  draft_term_grades:number;
  complete_final_grades:number;
  final_passed:number;
  final_failed:number;
};
type Distribution={
  advancing:number;
  benchmarking:number;
  connecting:number;
  developing:number;
  emerging:number;
};
type AttendanceTotals={
  present:number;
  absent:number;
  late:number;
  excused:number;
  total:number;
};
type ReportTab="overview"|"grades"|"intervention"|"attendance"|"classlist";
type GradePeriod="1"|"2"|"3"|"final";

function isoDate(date:Date){
  const y=date.getFullYear();
  const m=String(date.getMonth()+1).padStart(2,"0");
  const d=String(date.getDate()).padStart(2,"0");
  return y+"-"+m+"-"+d;
}

function currentMonthStart(){
  const now=new Date();
  return isoDate(new Date(now.getFullYear(),now.getMonth(),1));
}

function descriptor(value:number){
  if(value>=90)return "Advancing / Namumukod-tangi";
  if(value>=80)return "Benchmarking / Napamamalas";
  if(value>=75)return "Connecting / Natutungo";
  if(value>=65)return "Developing / Napauunlad";
  return "Emerging / Nagsisimula";
}

function csvEscape(value:unknown){
  const text=String(value??"");
  return '"'+text.replace(/"/g,'""')+'"';
}

function downloadCsv(filename:string,headers:string[],rows:unknown[][]){
  const content=[
    headers.map(csvEscape).join(","),
    ...rows.map(row=>row.map(csvEscape).join(",")),
  ].join("\r\n");
  const blob=new Blob(["\uFEFF"+content],{type:"text/csv;charset=utf-8"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url;
  a.download=filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function ReportsPage(){
  const [activeYear,setActiveYear]=useState<{id:string;name:string}|null>(null);
  const [gradeLevels,setGradeLevels]=useState<GradeLevel[]>([]);
  const [sections,setSections]=useState<Section[]>([]);
  const [subjects,setSubjects]=useState<Subject[]>([]);
  const [teachers,setTeachers]=useState<Teacher[]>([]);
  const [assignments,setAssignments]=useState<Assignment[]>([]);
  const [students,setStudents]=useState<Student[]>([]);
  const [gradeRows,setGradeRows]=useState<GradeRow[]>([]);
  const [attendanceRows,setAttendanceRows]=useState<AttendanceRow[]>([]);
  const [counts,setCounts]=useState<Counts>({
    enrolled_students:0,active_assignments:0,published_term_grades:0,
    draft_term_grades:0,complete_final_grades:0,final_passed:0,final_failed:0,
  });
  const [distribution,setDistribution]=useState<Distribution>({
    advancing:0,benchmarking:0,connecting:0,developing:0,emerging:0,
  });
  const [attendanceTotals,setAttendanceTotals]=useState<AttendanceTotals>({
    present:0,absent:0,late:0,excused:0,total:0,
  });
  const [grade,setGrade]=useState("");
  const [section,setSection]=useState("");
  const [teacher,setTeacher]=useState("");
  const [subject,setSubject]=useState("");
  const [from,setFrom]=useState(currentMonthStart());
  const [to,setTo]=useState(isoDate(new Date()));
  const [tab,setTab]=useState<ReportTab>("overview");
  const [period,setPeriod]=useState<GradePeriod>("1");
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");

  async function load(){
    setLoading(true);setError("");
    try{
      const params=new URLSearchParams();
      if(grade)params.set("grade",grade);
      if(section)params.set("section",section);
      if(teacher)params.set("teacher",teacher);
      if(subject)params.set("subject",subject);
      if(from)params.set("from",from);
      if(to)params.set("to",to);

      const r=await fetch("/api/admin/reports?"+params.toString(),{cache:"no-store"});
      const x=await r.json().catch(()=>({}));
      if(!r.ok){setError(x.error??"Unable to load reports.");return;}

      setActiveYear(x.activeYear??null);
      setGradeLevels(x.gradeLevels??[]);
      setSections(x.sections??[]);
      setSubjects(x.subjects??[]);
      setTeachers(x.teachers??[]);
      setAssignments(x.assignments??[]);
      setStudents(x.students??[]);
      setGradeRows(x.gradeRows??[]);
      setAttendanceRows(x.attendanceRows??[]);
      setCounts(x.counts??{});
      setDistribution(x.gradeDistribution??{});
      setAttendanceTotals(x.attendanceTotals??{});
    }catch{
      setError("Unable to reach the reports service.");
    }finally{
      setLoading(false);
    }
  }

  useEffect(()=>{void load();},[]);

  useEffect(()=>{
    if(section){
      const selected=sections.find(s=>s.id===section);
      if(selected&&grade&&String(selected.grade_level)!==grade)setSection("");
    }
  },[grade,section,sections]);

  const sectionOptions=useMemo(
    ()=>sections.filter(s=>!grade||String(s.grade_level)===grade),
    [sections,grade]
  );
  const subjectOptions=useMemo(
    ()=>subjects.filter(s=>!grade||String(s.grade_level)===grade),
    [subjects,grade]
  );

  function periodValue(row:GradeRow){
    if(period==="1")return row.term1;
    if(period==="2")return row.term2;
    if(period==="3")return row.term3;
    return row.final_grade;
  }

  const visibleGradeRows=useMemo(
    ()=>gradeRows
      .map(row=>({...row,report_grade:periodValue(row)}))
      .filter(row=>row.report_grade!==null)
      .sort((a,b)=>a.full_name.localeCompare(b.full_name)||a.subject_name.localeCompare(b.subject_name)),
    [gradeRows,period]
  );

  const interventionRows=useMemo(
    ()=>visibleGradeRows.filter(row=>Number(row.report_grade)<75),
    [visibleGradeRows]
  );

  const attendanceSorted=useMemo(
    ()=>[...attendanceRows].sort((a,b)=>
      b.absent-a.absent||
      b.late-a.late||
      a.full_name.localeCompare(b.full_name)
    ),
    [attendanceRows]
  );

  const classList=useMemo(
    ()=>[...students].sort((a,b)=>
      Number(a.grade_level??0)-Number(b.grade_level??0)||
      String(a.section_name??"").localeCompare(String(b.section_name??""))||
      a.full_name.localeCompare(b.full_name)
    ),
    [students]
  );

  const selectedAverage=visibleGradeRows.length
    ? Math.round(visibleGradeRows.reduce((sum,row)=>sum+Number(row.report_grade),0)/visibleGradeRows.length*100)/100
    : null;

  function exportCurrent(){
    const prefix=(activeYear?.name??"school-year").replace(/\s+/g,"-");

    if(tab==="grades"){
      downloadCsv(
        prefix+"-grade-report.csv",
        ["LRN","Learner","Grade","Section","Subject","Teacher",period==="final"?"Final Grade":"Term "+period+" Grade","Descriptor / Remark"],
        visibleGradeRows.map(row=>[
          row.lrn,row.full_name,row.grade_level,row.section_name,
          row.subject_name+(row.subject_code?" ("+row.subject_code+")":""),
          row.teacher_name,row.report_grade,
          period==="final"?(row.final_remark??""):descriptor(Number(row.report_grade)),
        ])
      );
      return;
    }

    if(tab==="intervention"){
      downloadCsv(
        prefix+"-intervention-report.csv",
        ["LRN","Learner","Grade","Section","Subject","Teacher","Period","Grade","Descriptor"],
        interventionRows.map(row=>[
          row.lrn,row.full_name,row.grade_level,row.section_name,
          row.subject_name,row.teacher_name,
          period==="final"?"Final":"Term "+period,
          row.report_grade,descriptor(Number(row.report_grade)),
        ])
      );
      return;
    }

    if(tab==="attendance"){
      downloadCsv(
        prefix+"-attendance-report.csv",
        ["LRN","Learner","Grade","Section","Recorded Days","Present","Late","Absent","Excused","Attendance Rate"],
        attendanceSorted.map(row=>[
          row.lrn,row.full_name,row.grade_level,row.section_name,row.total,
          row.present,row.late,row.absent,row.excused,
          row.attendance_rate===null?"":row.attendance_rate+"%",
        ])
      );
      return;
    }

    if(tab==="classlist"){
      downloadCsv(
        prefix+"-class-list.csv",
        ["LRN","Learner","Grade","Section"],
        classList.map(row=>[row.lrn,row.full_name,row.grade_level,row.section_name])
      );
      return;
    }

    downloadCsv(
      prefix+"-overview.csv",
      ["Metric","Value"],
      [
        ["Enrolled Students",counts.enrolled_students],
        ["Active Teaching Assignments",counts.active_assignments],
        ["Published Term Grades",counts.published_term_grades],
        ["Draft Term Grades",counts.draft_term_grades],
        ["Complete Final Grades",counts.complete_final_grades],
        ["Final Grades Passed",counts.final_passed],
        ["Final Grades Failed",counts.final_failed],
        ["Attendance Records",attendanceTotals.total],
        ["Attendance Present",attendanceTotals.present],
        ["Attendance Late",attendanceTotals.late],
        ["Attendance Absent",attendanceTotals.absent],
        ["Attendance Excused",attendanceTotals.excused],
      ]
    );
  }

  const totalDist=Object.values(distribution).reduce((a,b)=>a+b,0);
  function distWidth(value:number){
    return totalDist?Math.max(2,Math.round(value/totalDist*100)):0;
  }

  return <main className={styles.page}><div className={styles.shell}>
    <nav className={styles.topActions}>
      <a href="/portal" className={styles.topLink}><ArrowLeft size={16}/>Back to portal</a>
    </nav>

    <header className={styles.header}>
      <div>
        <span className={styles.eyebrow}>ADMINISTRATION</span>
        <h1>Reports & analytics</h1>
        <p>Enrollment, grades, intervention, attendance, and class-list reports from the live academic database.</p>
      </div>
      {activeYear&&<div className={styles.yearCard}><CheckCircle2 size={18}/><div><span>SCHOOL YEAR</span><strong>{activeYear.name}</strong></div></div>}
    </header>

    {error&&<div className={styles.error}>{error}</div>}

    <section className={styles.filters}>
      <label><span>Grade</span><select value={grade} onChange={e=>setGrade(e.target.value)}><option value="">All grades</option>{gradeLevels.map(g=><option key={g.grade_level} value={g.grade_level}>{g.label}</option>)}</select></label>
      <label><span>Section</span><select value={section} onChange={e=>setSection(e.target.value)}><option value="">All sections</option>{sectionOptions.map(s=><option key={s.id} value={s.id}>{"Grade "+s.grade_level+" · "+s.name}</option>)}</select></label>
      <label><span>Teacher</span><select value={teacher} onChange={e=>setTeacher(e.target.value)}><option value="">All teachers</option>{teachers.map(t=><option key={t.id} value={t.id}>{t.full_name}</option>)}</select></label>
      <label><span>Subject</span><select value={subject} onChange={e=>setSubject(e.target.value)}><option value="">All subjects</option>{subjectOptions.map(s=><option key={s.id} value={s.id}>{s.name}{s.code?" ("+s.code+")":""}</option>)}</select></label>
      <label><span>Attendance from</span><input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label>
      <label><span>Attendance to</span><input type="date" value={to} onChange={e=>setTo(e.target.value)}/></label>
      <button className={styles.apply} disabled={loading} onClick={()=>void load()}><RefreshCw size={16}/>{loading?"Loading…":"Apply filters"}</button>
    </section>

    <div className={styles.toolbar}>
      <div className={styles.tabs}>
        <button className={tab==="overview"?styles.tabActive:styles.tab} onClick={()=>setTab("overview")}><BarChart3 size={15}/>Overview</button>
        <button className={tab==="grades"?styles.tabActive:styles.tab} onClick={()=>setTab("grades")}><GraduationCap size={15}/>Grades</button>
        <button className={tab==="intervention"?styles.tabActive:styles.tab} onClick={()=>setTab("intervention")}><TriangleAlert size={15}/>Intervention</button>
        <button className={tab==="attendance"?styles.tabActive:styles.tab} onClick={()=>setTab("attendance")}><CalendarDays size={15}/>Attendance</button>
        <button className={tab==="classlist"?styles.tabActive:styles.tab} onClick={()=>setTab("classlist")}><Users size={15}/>Class lists</button>
      </div>
      <div className={styles.outputActions}>
        <button onClick={exportCurrent}><Download size={15}/>Export CSV</button>
        <button onClick={()=>window.print()}><Printer size={15}/>Print</button>
      </div>
    </div>

    {loading?<section className={styles.loading}><BarChart3 size={30}/><strong>Building report…</strong></section>:<>
      {tab==="overview"&&<div className={styles.overview}>
        <div className={styles.metrics}>
          <article><Users size={22}/><span>Enrolled students</span><strong>{counts.enrolled_students}</strong></article>
          <article><ClipboardList size={22}/><span>Teaching assignments</span><strong>{counts.active_assignments}</strong></article>
          <article><GraduationCap size={22}/><span>Published term grades</span><strong>{counts.published_term_grades}</strong><small>{counts.draft_term_grades} draft</small></article>
          <article><CheckCircle2 size={22}/><span>Complete final grades</span><strong>{counts.complete_final_grades}</strong><small>{counts.final_passed} passed · {counts.final_failed} failed</small></article>
        </div>

        <div className={styles.twoColumns}>
          <section className={styles.panel}>
            <div className={styles.panelHead}><div><h2>Proficiency distribution</h2><p>All published Term Grades matching the current filters.</p></div></div>
            <div className={styles.bars}>
              <div><span>Advancing · 90–100</span><b>{distribution.advancing}</b><i><em style={{width:distWidth(distribution.advancing)+"%"}}/></i></div>
              <div><span>Benchmarking · 80–89</span><b>{distribution.benchmarking}</b><i><em style={{width:distWidth(distribution.benchmarking)+"%"}}/></i></div>
              <div><span>Connecting · 75–79</span><b>{distribution.connecting}</b><i><em style={{width:distWidth(distribution.connecting)+"%"}}/></i></div>
              <div><span>Developing · 65–74</span><b>{distribution.developing}</b><i><em style={{width:distWidth(distribution.developing)+"%"}}/></i></div>
              <div><span>Emerging · 0–64</span><b>{distribution.emerging}</b><i><em style={{width:distWidth(distribution.emerging)+"%"}}/></i></div>
            </div>
          </section>

          <section className={styles.panel}>
            <div className={styles.panelHead}><div><h2>Attendance totals</h2><p>{from||"Start"} to {to||"Latest"} for the current filters.</p></div></div>
            <div className={styles.attendanceCards}>
              <div><span>Present</span><strong>{attendanceTotals.present}</strong></div>
              <div><span>Late</span><strong>{attendanceTotals.late}</strong></div>
              <div><span>Absent</span><strong>{attendanceTotals.absent}</strong></div>
              <div><span>Excused</span><strong>{attendanceTotals.excused}</strong></div>
            </div>
            <p className={styles.note}>{attendanceTotals.total} total recorded student-day attendance entries in this date range.</p>
          </section>
        </div>
      </div>}

      {(tab==="grades"||tab==="intervention")&&<section className={styles.panel}>
        <div className={styles.panelHead}>
          <div>
            <h2>{tab==="grades"?"Grade report":"Learners needing intervention"}</h2>
            <p>{tab==="grades"?"Published grades only.":"Only records below 75 for the selected period."}</p>
          </div>
          <select className={styles.periodSelect} value={period} onChange={e=>setPeriod(e.target.value as GradePeriod)}>
            <option value="1">Term 1</option>
            <option value="2">Term 2</option>
            <option value="3">Term 3</option>
            <option value="final">Final Grade</option>
          </select>
        </div>

        {tab==="grades"&&<div className={styles.inlineStats}>
          <span><strong>{visibleGradeRows.length}</strong> grade record{visibleGradeRows.length===1?"":"s"}</span>
          <span><strong>{selectedAverage??"—"}</strong> average</span>
        </div>}

        <div className={styles.tableWrap}>
          <table>
            <thead><tr><th>LRN</th><th>Learner</th><th>Class</th><th>Subject</th><th>Teacher</th><th>{period==="final"?"Final Grade":"Term "+period}</th><th>{period==="final"?"Remark":"Proficiency Descriptor"}</th></tr></thead>
            <tbody>
              {(tab==="grades"?visibleGradeRows:interventionRows).map(row=><tr key={row.student_id+"-"+row.assignment_id}>
                <td>{row.lrn||"—"}</td>
                <td><strong>{row.full_name}</strong></td>
                <td>Grade {row.grade_level} · {row.section_name}</td>
                <td>{row.subject_name}{row.subject_code?" ("+row.subject_code+")":""}</td>
                <td>{row.teacher_name}</td>
                <td className={Number(row.report_grade)<75?styles.lowGrade:styles.gradeCell}>{row.report_grade}</td>
                <td>{period==="final"?(row.final_remark??"—"):descriptor(Number(row.report_grade))}</td>
              </tr>)}
              {(tab==="grades"?visibleGradeRows:interventionRows).length===0&&<tr><td colSpan={7} className={styles.emptyCell}>No matching published grade records.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>}

      {tab==="attendance"&&<section className={styles.panel}>
        <div className={styles.panelHead}><div><h2>Attendance summary</h2><p>Present + Late is used for the displayed attendance rate. No risk threshold is applied.</p></div></div>
        <div className={styles.tableWrap}>
          <table>
            <thead><tr><th>LRN</th><th>Learner</th><th>Class</th><th>Recorded</th><th>Present</th><th>Late</th><th>Absent</th><th>Excused</th><th>Rate</th></tr></thead>
            <tbody>
              {attendanceSorted.map(row=><tr key={row.student_id}>
                <td>{row.lrn||"—"}</td><td><strong>{row.full_name}</strong></td><td>Grade {row.grade_level} · {row.section_name}</td>
                <td>{row.total}</td><td>{row.present}</td><td>{row.late}</td><td>{row.absent}</td><td>{row.excused}</td><td>{row.attendance_rate===null?"—":row.attendance_rate+"%"}</td>
              </tr>)}
              {attendanceSorted.length===0&&<tr><td colSpan={9} className={styles.emptyCell}>No enrolled students match these filters.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>}

      {tab==="classlist"&&<section className={styles.panel}>
        <div className={styles.panelHead}><div><h2>Class list</h2><p>Active student enrollments for {activeYear?.name??"the current school year"}.</p></div><span className={styles.countBadge}>{classList.length} student{classList.length===1?"":"s"}</span></div>
        <div className={styles.tableWrap}>
          <table>
            <thead><tr><th>No.</th><th>LRN</th><th>Learner</th><th>Grade</th><th>Section</th></tr></thead>
            <tbody>
              {classList.map((row,index)=><tr key={row.student_id}><td>{index+1}</td><td>{row.lrn||"—"}</td><td><strong>{row.full_name}</strong></td><td>{row.grade_level?"Grade "+row.grade_level:"—"}</td><td>{row.section_name||"—"}</td></tr>)}
              {classList.length===0&&<tr><td colSpan={5} className={styles.emptyCell}>No active students match these filters.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>}
    </>}
  </div></main>;
}
