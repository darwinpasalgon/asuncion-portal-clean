"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Save,
  UserCheck,
  XCircle,
} from "lucide-react";
import styles from "./attendance.module.css";

type Role="student"|"teacher";
type Year={id:string;name:string};
type Profile={id:string;full_name:string;lrn:string|null;role:Role};
type Adviser={id:string;section_id:string;teacher_id:string};
type Section={id:string;grade_level:number;name:string};
type Enrollment={id:string;student_id:string;grade_level:number;section_id:string|null};
type Student={id:string;full_name:string;lrn:string|null};
type RecordRow={id?:string;student_id:string;section_id:string;attendance_date:string;status:"present"|"absent"|"late"|"excused";note:string|null};
type Draft={status:"present"|"absent"|"late"|"excused";note:string};

function localDate(){
  const d=new Date();
  const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,"0"),day=String(d.getDate()).padStart(2,"0");
  return y+"-"+m+"-"+day;
}

function formatDate(value:string){
  const d=new Date(value+"T00:00:00");
  return d.toLocaleDateString([], {year:"numeric",month:"short",day:"numeric",weekday:"short"});
}

export default function AttendancePage(){
  const [role,setRole]=useState<Role|null>(null);
  const [profile,setProfile]=useState<Profile|null>(null);
  const [activeYear,setActiveYear]=useState<Year|null>(null);
  const [advisers,setAdvisers]=useState<Adviser[]>([]);
  const [sections,setSections]=useState<Section[]>([]);
  const [enrollments,setEnrollments]=useState<Enrollment[]>([]);
  const [students,setStudents]=useState<Student[]>([]);
  const [attendance,setAttendance]=useState<RecordRow[]>([]);
  const [date,setDate]=useState(localDate());
  const [sectionId,setSectionId]=useState("");
  const [drafts,setDrafts]=useState<Record<string,Draft>>({});
  const [loading,setLoading]=useState(true);
  const [working,setWorking]=useState(false);
  const [error,setError]=useState("");
  const [success,setSuccess]=useState("");

  async function load(targetDate=date){
    setLoading(true);setError("");
    try{
      const r=await fetch("/api/academic/attendance?date="+encodeURIComponent(targetDate),{cache:"no-store"});
      const x=await r.json().catch(()=>({}));
      if(!r.ok){setError(x.error??"Unable to load attendance.");return;}
      setRole(x.role??null);setProfile(x.profile??null);setActiveYear(x.activeYear??null);
      setAdvisers(x.advisers??[]);setSections(x.sections??[]);setEnrollments(x.enrollments??[]);
      setStudents(x.students??[]);setAttendance(x.attendance??[]);
      if(x.role==="teacher" && !sectionId && x.sections?.[0]?.id)setSectionId(x.sections[0].id);
    }catch{setError("Unable to reach the attendance service.");}
    finally{setLoading(false);}
  }

  useEffect(()=>{void load(date);},[]);

  const studentMap=useMemo(()=>new Map(students.map(s=>[s.id,s])),[students]);
  const selectedSection=sections.find(s=>s.id===sectionId);
  const roster=useMemo(()=>{
    if(role!=="teacher"||!sectionId)return [];
    return enrollments
      .filter(e=>e.section_id===sectionId)
      .map(e=>studentMap.get(e.student_id))
      .filter((s):s is Student=>Boolean(s))
      .sort((a,b)=>a.full_name.localeCompare(b.full_name));
  },[role,sectionId,enrollments,studentMap]);

  useEffect(()=>{
    if(role!=="teacher"||!sectionId)return;
    const next:Record<string,Draft>={};
    for(const student of roster){
      const existing=attendance.find(a=>a.student_id===student.id&&a.section_id===sectionId);
      next[student.id]={status:existing?.status??"present",note:existing?.note??""};
    }
    setDrafts(next);
  },[role,sectionId,roster,attendance]);

  function markAllPresent(){
    const next:Record<string,Draft>={};
    for(const s of roster)next[s.id]={status:"present",note:drafts[s.id]?.note??""};
    setDrafts(next);
  }

  function update(studentId:string,field:keyof Draft,value:string){
    setDrafts(cur=>({
      ...cur,
      [studentId]:{
        ...(cur[studentId]??{status:"present",note:""}),
        [field]:value,
      } as Draft,
    }));
  }

  async function save(){
    if(!sectionId||!roster.length)return;
    setWorking(true);setError("");setSuccess("");
    try{
      const r=await fetch("/api/academic/attendance",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          action:"save_attendance",
          sectionId,
          attendanceDate:date,
          records:roster.map(s=>({
            studentId:s.id,
            status:drafts[s.id]?.status??"present",
            note:drafts[s.id]?.note??"",
          })),
        }),
      });
      const x=await r.json().catch(()=>({}));
      if(!r.ok){setError(x.error??"Unable to save attendance.");return;}
      const savedCount=x.count??roster.length;
      setSuccess("Attendance saved for "+savedCount+" student"+(savedCount===1?"":"s")+".");
      await load(date);
    }catch{setError("Unable to reach the attendance service.");}
    finally{setWorking(false);}
  }

  const counts=useMemo(()=>{
    const rows=role==="student"?attendance:attendance.filter(a=>a.section_id===sectionId);
    return {
      total:rows.length,
      present:rows.filter(a=>a.status==="present").length,
      late:rows.filter(a=>a.status==="late").length,
      absent:rows.filter(a=>a.status==="absent").length,
      excused:rows.filter(a=>a.status==="excused").length,
    };
  },[role,attendance,sectionId]);

  const attended=counts.present+counts.late;
  const rate=counts.total?Math.round(attended/counts.total*100):0;

  if(loading)return <main className={styles.loading}><ClipboardCheck size={34}/><strong>Loading attendance…</strong></main>;

  return <main className={styles.page}><div className={styles.shell}>
    <nav className={styles.topActions}>
      <a href="/portal" className={styles.topLink}><ArrowLeft size={16}/>Back to portal</a>
    </nav>

    <header className={styles.header}>
      <div>
        <span className={styles.eyebrow}>ACADEMIC RECORDS</span>
        <h1>{role==="teacher"?"Daily attendance":"My attendance"}</h1>
        <p>{role==="teacher"
          ?"Record daily section attendance for sections assigned to you as Attendance Teacher / Adviser."
          :"Your recorded attendance for the active school year."}</p>
      </div>
      {activeYear&&<div className={styles.yearCard}><CheckCircle2 size={18}/><div><span>SCHOOL YEAR</span><strong>{activeYear.name}</strong></div></div>}
    </header>

    {error&&<div className={styles.error}>{error}</div>}
    {success&&<div className={styles.success}>{success}</div>}

    {role==="teacher"&&<>
      {sections.length===0
        ?<section className={styles.emptyPanel}>
          <UserCheck size={30}/>
          <strong>No adviser section assigned</strong>
          <p>An Administrator must assign you as the Attendance Teacher / Adviser for a section before you can record daily attendance.</p>
        </section>
        :<>
          <section className={styles.controls}>
            <label>
              <span>Section</span>
              <select value={sectionId} onChange={e=>setSectionId(e.target.value)}>
                {sections.map(s=><option key={s.id} value={s.id}>{"Grade "+s.grade_level+" · "+s.name}</option>)}
              </select>
            </label>
            <label><span>Date</span><input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label>
            <button className={styles.loadButton} onClick={()=>void load(date)}><CalendarDays size={16}/>Load date</button>
          </section>

          <section className={styles.panel}>
            <div className={styles.panelHeading}>
              <div>
                <h2>{selectedSection?("Grade "+selectedSection.grade_level+" · "+selectedSection.name):"Attendance sheet"}</h2>
                <p>{formatDate(date)+" · "+roster.length+" enrolled student"+(roster.length===1?"":"s")}</p>
              </div>
              <div className={styles.actions}>
                <button className={styles.markAll} onClick={markAllPresent}><CheckCircle2 size={16}/>Mark all Present</button>
                <button className={styles.saveAll} disabled={working||!roster.length} onClick={()=>void save()}><Save size={16}/>{working?"Saving…":"Save attendance"}</button>
              </div>
            </div>

            {roster.length===0
              ?<div className={styles.empty}>No active students are enrolled in this section.</div>
              :<div className={styles.roster}>
                {roster.map((student,index)=>{
                  const d=drafts[student.id]??{status:"present",note:""};
                  return <article key={student.id}>
                    <div className={styles.student}>
                      <span>{index+1}</span>
                      <div><strong>{student.full_name}</strong><small>{student.lrn?("LRN "+student.lrn):"Student"}</small></div>
                    </div>
                    <select className={styles[d.status]} value={d.status} onChange={e=>update(student.id,"status",e.target.value)}>
                      <option value="present">Present</option>
                      <option value="absent">Absent</option>
                      <option value="late">Late</option>
                      <option value="excused">Excused</option>
                    </select>
                    <input maxLength={300} placeholder="Optional note" value={d.note} onChange={e=>update(student.id,"note",e.target.value)}/>
                  </article>;
                })}
              </div>}
          </section>
        </>}
    </>}

    {role==="student"&&<>
      <div className={styles.summary}>
        <article><ClipboardCheck size={22}/><span>Recorded days</span><strong>{counts.total}</strong></article>
        <article><CheckCircle2 size={22}/><span>Present</span><strong>{counts.present}</strong></article>
        <article><Clock3 size={22}/><span>Late</span><strong>{counts.late}</strong></article>
        <article><XCircle size={22}/><span>Absent / Excused</span><strong>{counts.absent+" / "+counts.excused}</strong></article>
        <article><UserCheck size={22}/><span>Attendance rate</span><strong>{rate+"%"}</strong><small>Present + Late ÷ recorded days</small></article>
      </div>

      <section className={styles.panel}>
        <div className={styles.panelHeading}><div><h2>Attendance history</h2><p>{(profile?.full_name??"Student")+" · latest recorded school days"}</p></div></div>
        {attendance.length===0
          ?<div className={styles.empty}>No attendance records have been recorded for you yet.</div>
          :<div className={styles.history}>
            {attendance.map((a,i)=><article key={a.id??i}>
              <div><strong>{formatDate(a.attendance_date)}</strong><small>{a.note||"No note"}</small></div>
              <span className={styles[a.status]}>{a.status[0].toUpperCase()+a.status.slice(1)}</span>
            </article>)}
          </div>}
      </section>
    </>}
  </div></main>;
}
