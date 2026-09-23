"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  RefreshCw,
  School,
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
type Attendance={student_id:string;section_id:string;status:string;note:string|null};

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
      setStudents(x.students??[]); setAttendance(x.attendance??[]);
    }catch{setError("Unable to reach the attendance service.");}
    finally{setLoading(false);}
  }

  useEffect(()=>{void load(date);},[]);

  const teacherMap=useMemo(()=>new Map(teachers.map(t=>[t.id,t.full_name])),[teachers]);
  const studentMap=useMemo(()=>new Map(students.map(s=>[s.id,s])),[students]);

  function adviserFor(sectionId:string){return advisers.find(a=>a.section_id===sectionId);}
  function enrolledCount(sectionId:string){return enrollments.filter(e=>e.section_id===sectionId).length;}
  function count(status:string,sectionId?:string){return attendance.filter(a=>(!sectionId||a.section_id===sectionId)&&a.status===status).length;}

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
    <nav className={styles.topActions}><a href="/portal" className={styles.topLink}><ArrowLeft size={16}/>Back to portal</a></nav>
    <header className={styles.header}>
      <div><span className={styles.eyebrow}>ADMINISTRATION</span><h1>Attendance</h1><p>Assign the Attendance Teacher / Adviser for each section and review the daily attendance overview.</p></div>
      {activeYear&&<div className={styles.yearCard}><CheckCircle2 size={18}/><div><span>ACTIVE SCHOOL YEAR</span><strong>{activeYear.name}</strong></div></div>}
    </header>
    {error&&<div className={styles.error}>{error}</div>}{success&&<div className={styles.success}>{success}</div>}

    <div className={styles.summary}>
      <article><Users size={22}/><span>Enrolled students</span><strong>{enrollments.length}</strong></article>
      <article><ClipboardCheck size={22}/><span>Present</span><strong>{count("present")}</strong></article>
      <article><CalendarDays size={22}/><span>Late</span><strong>{count("late")}</strong></article>
      <article><School size={22}/><span>Absent / Excused</span><strong>{count("absent")+count("excused")}</strong></article>
    </div>

    <section className={styles.panel}>
      <div className={styles.panelHeading}><div><h2>Daily overview</h2><p>Attendance recorded across all sections for the selected date.</p></div>
        <div className={styles.dateTools}><input type="date" value={date} onChange={e=>setDate(e.target.value)}/><button onClick={()=>void load(date)}><RefreshCw size={16}/>Load</button></div>
      </div>
      <div className={styles.overviewGrid}>
        {sections.map(s=><article key={s.id}>
          <div><span>Grade {s.grade_level}</span><strong>{s.name}</strong><small>{enrolledCount(s.id)} enrolled</small></div>
          <div className={styles.counts}><span>P <b>{count("present",s.id)}</b></span><span>L <b>{count("late",s.id)}</b></span><span>A <b>{count("absent",s.id)}</b></span><span>E <b>{count("excused",s.id)}</b></span></div>
        </article>)}
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
                  <option value="">Select adviser</option>
                  {teachers.map(t=><option key={t.id} value={t.id}>{t.full_name}</option>)}
                </select>
                <small>{a?teacherMap.get(a.teacher_id):"Not assigned"}</small>
              </div>
            })}
          </article>
        })}
      </div>}
    </section>
  </div></main>;
}
