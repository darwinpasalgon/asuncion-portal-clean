"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  AlertTriangle,
  CalendarDays,
  CalendarOff,
  CheckCircle2,
  ClipboardCheck,
  RefreshCw,
  UserCheck,
  Users,
} from "lucide-react";
import styles from "./attendance.module.css";

type Year={id:string;name:string};
type Grade={grade_level:number;label:string};
type Section={id:string;grade_level:number;name:string};
type Teacher={id:string;full_name:string;email:string};
type Adviser={id:string;section_id:string;teacher_id:string};
type Enrollment={student_id:string;grade_level:number;section_id:string|null};
type Student={id:string;full_name:string;lrn:string|null};
type DailyStatus="present"|"absent"|"absent_morning"|"cutting_classes";
type Attendance={student_id:string;section_id:string;status:DailyStatus|"transferred_in"|"transferred_out"|"dropped";note:string|null};
type Exclusion={id:string;section_id:string;attendance_date:string;exclusion_type:"regular_holiday"|"special_non_working_holiday"|"class_suspension";reason:string|null};

const DAILY_STATUSES:DailyStatus[]=["present","absent","absent_morning","cutting_classes"];
const STATUS_LABELS:Record<DailyStatus,string>={
  present:"Present",
  absent:"Absent",
  absent_morning:"Absent in the Morning",
  cutting_classes:"Cutting Classes",
};
const EXCLUSION_LABELS:Record<Exclusion["exclusion_type"],string>={
  regular_holiday:"Regular Holiday",
  special_non_working_holiday:"Special Non-Working Holiday",
  class_suspension:"Suspension of Classes",
};

function localDate(){
  const d=new Date();
  const y=d.getFullYear();
  const m=String(d.getMonth()+1).padStart(2,"0");
  const day=String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${day}`;
}

export default function AdminAttendancePage(){
  const [activeYear,setActiveYear]=useState<Year|null>(null);
  const [grades,setGrades]=useState<Grade[]>([]);
  const [sections,setSections]=useState<Section[]>([]);
  const [teachers,setTeachers]=useState<Teacher[]>([]);
  const [advisers,setAdvisers]=useState<Adviser[]>([]);
  const [enrollments,setEnrollments]=useState<Enrollment[]>([]);
  const [students,setStudents]=useState<Student[]>([]);
  const [attendance,setAttendance]=useState<Attendance[]>([]);
  const [exclusions,setExclusions]=useState<Exclusion[]>([]);
  const [date,setDate]=useState(localDate());
  const [working,setWorking]=useState("");
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [success,setSuccess]=useState("");

  async function load(targetDate=date){
    setLoading(true); setError("");
    try{
      const r=await fetch(`/api/admin/attendance?date=${encodeURIComponent(targetDate)}`,{cache:"no-store"});
      const x=await r.json().catch(()=>({}));
      if(!r.ok){setError(x.error??"Unable to load attendance administration.");return;}
      setActiveYear(x.activeYear??null); setGrades(x.grades??[]); setSections(x.sections??[]);
      setTeachers(x.teachers??[]); setAdvisers(x.advisers??[]); setEnrollments(x.enrollments??[]);
      setStudents(x.students??[]); setAttendance(x.attendance??[]); setExclusions(x.exclusions??[]);
    }catch{setError("Unable to reach the attendance service.");}
    finally{setLoading(false);}
  }

  useEffect(()=>{void load(date);},[]);

  const teacherMap=useMemo(()=>new Map(teachers.map(t=>[t.id,t.full_name])),[teachers]);
  const studentMap=useMemo(()=>new Map(students.map(s=>[s.id,s])),[students]);
  const dailyAttendance=useMemo(
    ()=>attendance.filter(a=>DAILY_STATUSES.includes(a.status as DailyStatus)),
    [attendance]
  );
  const excludedSectionIds=useMemo(()=>new Set(exclusions.map(x=>x.section_id)),[exclusions]);

  function adviserFor(sectionId:string){return advisers.find(a=>a.section_id===sectionId);}
  function enrolledCount(sectionId:string){return enrollments.filter(e=>e.section_id===sectionId).length;}
  function count(status:DailyStatus,sectionId?:string){return dailyAttendance.filter(a=>(!sectionId||a.section_id===sectionId)&&a.status===status).length;}
  function sectionRecords(sectionId:string,status?:DailyStatus){
    return dailyAttendance.filter(a=>a.section_id===sectionId&&(!status||a.status===status));
  }
  function sectionStudents(sectionId:string){
    const ids=new Set(enrollments.filter(e=>e.section_id===sectionId).map(e=>e.student_id));
    return Array.from(ids).map(id=>studentMap.get(id)).filter((s):s is Student=>Boolean(s)).sort((a,b)=>a.full_name.localeCompare(b.full_name));
  }
  function unrecorded(sectionId:string){
    if(excludedSectionIds.has(sectionId))return [];
    const recorded=new Set(sectionRecords(sectionId).map(a=>a.student_id));
    return sectionStudents(sectionId).filter(s=>!recorded.has(s.id));
  }
  const unrecordedTotal=sections.reduce((sum,s)=>sum+unrecorded(s.id).length,0);

  async function setAdviser(sectionId:string,teacherId:string){
    if(!teacherId)return;
    setWorking(sectionId);setError("");setSuccess("");
    try{
      const r=await fetch("/api/admin/attendance",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"set_adviser",sectionId,teacherId})});
      const x=await r.json().catch(()=>({}));
      if(!r.ok){setError(x.error??"Unable to assign adviser.");return;}
      setSuccess("Attendance Teacher / Adviser updated.");
      await load(date);
    }catch{setError("Unable to reach the attendance service.");}
    finally{setWorking("");}
  }

  return <main className={styles.page}><div className={styles.shell}>
    <nav className={styles.topActions}><a href="/portal" className={styles.topLink}><ArrowLeft size={16}/>Back to Portal</a></nav>
    <header className={styles.header}>
      <div><span className={styles.eyebrow}>ADMINISTRATION</span><h1>Attendance</h1><p>Assign the Attendance Teacher / Adviser for each section and review the daily attendance overview.</p></div>
      {activeYear&&<div className={styles.yearCard}><CheckCircle2 size={18}/><div><span>ACTIVE SCHOOL YEAR</span><strong>{activeYear.name}</strong></div></div>}
    </header>
    {error&&<div className={styles.error}>{error}</div>}{success&&<div className={styles.success}>{success}</div>}

    <div className={styles.dailyNote}>
      <div>
        <span>DAILY ATTENDANCE</span>
        <strong>{date}</strong>
        <small>Transfer and Dropped tags are learner movement records and are not included in this daily attendance view.</small>
      </div>
      <div className={styles.dateTools}><input type="date" max={localDate()} value={date} onChange={e=>setDate(e.target.value)}/><button onClick={()=>void load(date)}><RefreshCw size={16}/>Load</button></div>
    </div>

    <div className={styles.summary}>
      <article><ClipboardCheck size={22}/><span>Present</span><strong>{count("present")}</strong></article>
      <article><CalendarDays size={22}/><span>Absent</span><strong>{count("absent")}</strong></article>
      <article><UserCheck size={22}/><span>Absent in the Morning</span><strong>{count("absent_morning")}</strong></article>
      <article><AlertTriangle size={22}/><span>Cutting Classes</span><strong>{count("cutting_classes")}</strong></article>
      <article className={unrecordedTotal?styles.needsAttention:""}><Users size={22}/><span>Unrecorded</span><strong>{unrecordedTotal}</strong></article>
    </div>

    <section className={styles.panel}>
      <div className={styles.panelHeading}><div><h2>Daily Overview by Section</h2><p>Open a section to see exactly who is Present, Absent, Absent in the Morning, or Cutting Classes.</p></div></div>
      <div className={styles.overviewGrid}>
        {sections.map(s=>{
          const exclusion=exclusions.find(x=>x.section_id===s.id);
          const missing=unrecorded(s.id);
          return <details className={styles.sectionOverview} key={s.id}>
            <summary>
              <div><span>Grade {s.grade_level}</span><strong>{s.name}</strong><small>{enrolledCount(s.id)} enrolled</small></div>
              {exclusion?<div className={styles.noClassesBadge}><CalendarOff size={16}/><div><strong>No Classes</strong><span>{EXCLUSION_LABELS[exclusion.exclusion_type]}</span></div></div>:
              <div className={styles.counts}><span>P <b>{count("present",s.id)}</b></span><span>A <b>{count("absent",s.id)}</b></span><span>AM <b>{count("absent_morning",s.id)}</b></span><span>CC <b>{count("cutting_classes",s.id)}</b></span><span className={missing.length?styles.unrecordedPill:""}>U <b>{missing.length}</b></span></div>}
            </summary>
            {exclusion?<div className={styles.noClassesDetail}><CalendarOff size={20}/><div><strong>{EXCLUSION_LABELS[exclusion.exclusion_type]}</strong><span>{exclusion.reason||"No additional reason provided."}</span></div></div>:
            <div className={styles.statusColumns}>
              {DAILY_STATUSES.map(status=><div className={styles.statusGroup} key={status}>
                <div className={styles.statusGroupHeading}><strong>{STATUS_LABELS[status]}</strong><span>{sectionRecords(s.id,status).length}</span></div>
                <div className={styles.nameList}>{sectionRecords(s.id,status).length===0?<small>None</small>:sectionRecords(s.id,status).map(record=>studentMap.get(record.student_id)).filter((student):student is Student=>Boolean(student)).sort((a,b)=>a.full_name.localeCompare(b.full_name)).map(student=><span key={student.id}><strong>{student.full_name}</strong><small>{student.lrn?("LRN "+student.lrn):"LRN Not Recorded"}</small></span>)}</div>
              </div>)}
              <div className={`${styles.statusGroup} ${styles.unrecordedGroup}`}>
                <div className={styles.statusGroupHeading}><strong>Unrecorded</strong><span>{missing.length}</span></div>
                <div className={styles.nameList}>{missing.length===0?<small>None</small>:missing.map(student=><span key={student.id}><strong>{student.full_name}</strong><small>{student.lrn?("LRN "+student.lrn):"LRN Not Recorded"}</small></span>)}</div>
              </div>
            </div>}
          </details>
        })}
      </div>
    </section>

    <section className={styles.panel}>
      <div className={styles.panelHeading}><div><h2>Attendance Teachers / Advisers</h2><p>One designated Teacher records the daily attendance for each section.</p></div></div>
      {loading?<div className={styles.empty}>Loading adviser assignments…</div>:
      <div className={styles.gradeGrid}>
        {grades.map(g=>{
          const gs=sections.filter(s=>s.grade_level===g.grade_level);
          if(!gs.length)return null;
          return <article className={styles.gradeCard} key={g.grade_level}><h3>{g.label}</h3>
            {gs.map(s=>{
              const a=adviserFor(s.id);
              return <div className={styles.sectionRow} key={s.id}>
                <div><strong>{s.name}</strong><span>{enrolledCount(s.id)} student{enrolledCount(s.id)===1?"":"s"}</span></div>
                <select value={a?.teacher_id??""} disabled={working===s.id} onChange={e=>void setAdviser(s.id,e.target.value)}>
                  <option value="">Select Adviser</option>
                  {teachers.map(t=><option key={t.id} value={t.id}>{t.full_name}</option>)}
                </select>
                <small>{a?teacherMap.get(a.teacher_id):"Not Assigned"}</small>
              </div>
            })}
          </article>
        })}
      </div>}
    </section>
  </div></main>;
}
