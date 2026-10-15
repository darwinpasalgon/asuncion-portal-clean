"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, AlertTriangle, CheckCircle2, Clock3, Pencil, Save, X } from "lucide-react";
import styles from "./grade12-term-program.module.css";

type Period = {
  id: string; section_id: string; term_no: number; day_of_week: number; start_time: string;
  end_time: string; subject_label: string; instructor_label: string; instructor_ids: string[];
  needs_review: boolean; review_reason: string | null; source_sheet: string; source_row: number; source_file: string;
};
type Section = { id: string; name: string };
type Teacher = { id: string; full_name: string };
const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday"];
const timeLabel = (s: string) => {
  const [hour,minute] = s.slice(0,5).split(":").map(Number);
  return `${hour % 12 || 12}:${String(minute).padStart(2,"0")} ${hour < 12 ? "AM" : "PM"}`;
};
export default function Grade12TermProgramPage() {
  const [sections,setSections] = useState<Section[]>([]);
  const [teachers,setTeachers] = useState<Teacher[]>([]);
  const [periods,setPeriods] = useState<Period[]>([]);
  const [section,setSection] = useState("");
  const [term,setTerm] = useState(1);
  const [reviewOnly,setReviewOnly] = useState(false);
  const [edit,setEdit] = useState<Period|null>(null);
  const [subject,setSubject] = useState("");
  const [instructorIds,setInstructorIds] = useState<string[]>([]);
  const [start,setStart] = useState("");
  const [end,setEnd] = useState("");
  const [loading,setLoading] = useState(true);
  const [saving,setSaving] = useState(false);
  const [error,setError] = useState("");
  const [success,setSuccess] = useState("");
  useEffect(()=>{
    let alive=true;
    async function run() {
      try{
        const r=await fetch("/api/admin/grade12-term-program",{cache:"no-store"});
        const d=await r.json().catch(()=>({}));
        if(!r.ok)throw new Error(d.error ?? "Unable to load Grade 12 schedules.");
        if(!alive)return;
        setSections(d.sections??[]);setTeachers(d.teachers??[]);setPeriods(d.periods??[]);
        const requestedSection=new URLSearchParams(window.location.search).get("section");
        const valid=(d.sections??[]).find((s:Section)=>s.id===requestedSection || s.name.toLowerCase()===requestedSection?.toLowerCase());
        setSection(valid?.id ?? d.sections?.[0]?.id ?? "");
        const requestedTerm=Number(new URLSearchParams(window.location.search).get("term"));
        if(requestedTerm===1 || requestedTerm===2)setTerm(requestedTerm);
      }catch(e){if(alive)setError(e instanceof Error?e.message:"Unable to load schedules.");}
      finally{if(alive)setLoading(false);}
    }
    void run();return()=>{alive=false};
  },[]);
  const teacherMap=useMemo(()=>new Map(teachers.map(t=>[t.id,t.full_name])),[teachers]);
  const visible=useMemo(()=>periods.filter(p=>p.section_id===section && p.term_no===term && (!reviewOnly || p.needs_review))
    .sort((a,b)=>a.day_of_week-b.day_of_week || a.start_time.localeCompare(b.start_time)),[periods,section,term,reviewOnly]);
  const countByTerm=(n:number)=>periods.filter(p=>p.term_no===n).length;
  const pendingForTerm=(n:number)=>periods.filter(p=>p.term_no===n && (!p.instructor_ids || !p.instructor_ids.length)).length;
  const flagged=visible.filter(p=>p.needs_review).length;
  const instructorNames=(period:Period)=>{
    const names=(period.instructor_ids??[]).map(id=>teacherMap.get(id)).filter(Boolean);
    return names.length ? names.join(" / ") : period.instructor_label+" (Unmatched)";
  };
  function openEdit(p:Period){
    setEdit(p);setSubject(p.subject_label);setInstructorIds(p.instructor_ids??[]);
    setStart(p.start_time.slice(0,5));setEnd(p.end_time.slice(0,5));setError("");setSuccess("");
  }
  async function save(){
    if(!edit || saving)return;
    setSaving(true);setError("");
    try{
      const r=await fetch("/api/admin/grade12-term-program",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
        action:"update_period",id:edit.id,subject_label:subject,instructor_ids:instructorIds,start_time:start,end_time:end,
      })});
      const d=await r.json().catch(()=>({}));
      if(!r.ok){
        const conflict=d.conflicts?.length ? " Conflicting Grade 12 section: "+sections.find(s=>s.id===d.conflicts[0].section_id)?.name : "";
        throw new Error((d.error??"Unable to save schedule.")+conflict);
      }
      setPeriods(current=>current.map(p=>p.id===edit.id?{...p,...d.period}:p));
      setEdit(null);setSuccess(d.message ?? "Schedule updated.");
    }catch(e){setError(e instanceof Error?e.message:"Schedule update failed.");}
    finally{setSaving(false);}
  }
  return <main className={styles.page}><div className={styles.shell}>
    <a className={styles.back} href="/portal/admin/schedules"><ArrowLeft size={16}/>Back to Class Schedules</a>
    <header className={styles.header}>
      <span>GRADE 12 · SCHOOL YEAR 2026–2027</span>
      <h1>Term Class Programs</h1>
      <p>Subject teacher assignments and class periods imported from the official First and Second Term Excel programs. Terms are separate; Grade 7–11 schedules are unchanged.</p>
    </header>
    {error && <div className={styles.error} role="alert">{error}</div>}
    {success && <div className={styles.success} role="status"><CheckCircle2 size={16}/>{success}</div>}
    {loading ? <p>Loading class programs…</p> : <>
      <div className={styles.summary}>
        <div><span>First Term</span><strong>{countByTerm(1)} periods</strong><small>{pendingForTerm(1)} unmatched instructor periods</small></div>
        <div><span>Second Term</span><strong>{countByTerm(2)} periods</strong><small>{pendingForTerm(2)} unmatched instructor periods</small></div>
        <div><span>Source Sections</span><strong>{sections.length}</strong><small>All official Grade 12 sections</small></div>
      </div>
      <section className={styles.controls}>
        <div className={styles.termSwitch} role="group" aria-label="Select Term">
          {[1,2].map(n=><button key={n} type="button" aria-pressed={term===n} className={term===n?styles.selected:""} onClick={()=>{setTerm(n);setError("");}}>{n===1?"First Term":"Second Term"}</button>)}
        </div>
        <label>Section
          <select value={section} onChange={e=>setSection(e.target.value)}>
            {sections.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
        <label className={styles.reviewControl}><input type="checkbox" checked={reviewOnly} onChange={e=>setReviewOnly(e.target.checked)}/> Review Flags Only</label>
      </section>
      <div className={styles.legend}>
        <span><Clock3 size={15}/>Times follow the Excel, including 4:45 PM endings</span>
        <span><AlertTriangle size={15}/> {flagged} flagged periods in this view</span>
      </div>
      <section className={styles.calendar}>
        {DAYS.map((day,index)=><div className={styles.day} key={day}>
          <h2>{day}</h2>
          {visible.filter(p=>p.day_of_week===index+1).map(p=><article className={p.needs_review?styles.flagged:styles.period} key={p.id}>
            <div className={styles.periodHead}><span>{timeLabel(p.start_time)}–{timeLabel(p.end_time)}</span><button type="button" onClick={()=>openEdit(p)} aria-label={`Edit ${p.subject_label} ${day}`}><Pencil size={15}/></button></div>
            <h3>{p.subject_label}</h3>
            {p.subject_label.includes("ORGANIC AGRICULTURE PRODUCTION/FOOD PROCESSING") && (p.instructor_ids??[]).length===2 ? (
              <p><strong>Organic Agriculture Production:</strong> {teacherMap.get(p.instructor_ids[0])??"Not Matched"}<br/>
                <strong>Food Processing:</strong> {teacherMap.get(p.instructor_ids[1])??"Not Matched"}</p>
            ) : <p>{instructorNames(p)}</p>}
            {p.needs_review && <div className={styles.flagText}><AlertTriangle size={14}/><span>{p.review_reason??"Needs review"}</span></div>}
          </article>)}
          {!visible.some(p=>p.day_of_week===index+1)&&<p className={styles.empty}>No scheduled periods</p>}
        </div>)}
      </section>
      <p className={styles.footer}>Unmatched teachers must be selected from existing portal accounts. An imported schedule is not a substitute for a grading assignment; this view keeps Term 1 and Term 2 staffing separate.</p>
    </>}
    {edit && <div className={styles.overlay} role="presentation"><section className={styles.dialog} role="dialog" aria-modal="true" aria-label="Edit term period">
      <div className={styles.dialogHead}><div><strong>Edit {term===1?"First":"Second"} Term Period</strong><span>{sections.find(s=>s.id===edit.section_id)?.name} · {DAYS[edit.day_of_week-1]}</span></div><button type="button" onClick={()=>setEdit(null)} aria-label="Close"><X size={20}/></button></div>
      <label>Subject<input value={subject} onChange={e=>setSubject(e.target.value)}/></label>
      {edit.subject_label.includes("ORGANIC AGRICULTURE PRODUCTION/FOOD PROCESSING") ? (
        <div className={styles.timeRow}>
          <label>Organic Agriculture Production Teacher
            <select value={instructorIds[0]??""} onChange={e=>setInstructorIds([e.target.value,instructorIds[1]??""])}>
              <option value="">Select Teacher</option>
              {teachers.map(t=><option value={t.id} key={t.id}>{t.full_name}</option>)}
            </select>
          </label>
          <label>Food Processing Teacher
            <select value={instructorIds[1]??""} onChange={e=>setInstructorIds([instructorIds[0]??"",e.target.value])}>
              <option value="">Select Teacher</option>
              {teachers.map(t=><option value={t.id} key={t.id}>{t.full_name}</option>)}
            </select>
          </label>
        </div>
      ) : (
        <label>Teacher Assignment <small>Hold Ctrl (Windows) or Command (Mac) to select multiple teachers.</small>
          <select multiple size={7} value={instructorIds} onChange={e=>setInstructorIds(Array.from(e.currentTarget.selectedOptions).map(o=>o.value))}>
            {teachers.map(t=><option value={t.id} key={t.id}>{t.full_name}</option>)}
          </select>
        </label>
      )}
      <label>Original Teacher in Excel<input readOnly value={edit.instructor_label}/></label>
      <div className={styles.timeRow}><label>Start Time<input type="time" min="07:30" max="16:45" value={start} onChange={e=>setStart(e.target.value)}/></label><label>End Time<input type="time" min="07:30" max="16:45" value={end} onChange={e=>setEnd(e.target.value)}/></label></div>
      <p className={styles.note}>Editing this period changes only this term and day. Teacher conflicts are checked before changes are saved; the original Excel instructor remains visible for reference.</p>
      <button className={styles.save} type="button" onClick={()=>void save()} disabled={saving||!subject.trim()||start>=end||(subject.includes("ORGANIC AGRICULTURE PRODUCTION/FOOD PROCESSING")&&(instructorIds.length!==2||instructorIds.some(id=>!id)||instructorIds[0]===instructorIds[1]))}><Save size={16}/>{saving?"Saving…":"Save Period"}</button>
    </section></div>}
  </div></main>;
}
