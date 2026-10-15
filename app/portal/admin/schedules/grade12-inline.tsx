"use client";

import {useEffect,useMemo,useState} from "react";
import {AlertTriangle,CalendarDays,Clock3,Pencil,RefreshCw,Save,X} from "lucide-react";
import styles from "./schedules.module.css";

type Period={id:string;section_id:string;term_no:number;day_of_week:number;start_time:string;end_time:string;subject_label:string;instructor_label:string;instructor_ids:string[];needs_review:boolean;review_reason:string|null;source_sheet:string};
type Teacher={id:string;full_name:string};
type Section={id:string;name:string};
const weekdays=["Monday","Tuesday","Wednesday","Thursday","Friday"];
const shortDays=["Mon","Tue","Wed","Thu","Fri"];
const timeLabel=(time:string)=>{const h=Number(time.slice(0,2));return `${h%12||12}:${time.slice(3,5)} ${h>=12?"PM":"AM"}`;};
const originalName=(p:Period,teachers:Map<string,string>)=>(p.instructor_ids??[]).map(id=>teachers.get(id)).filter(Boolean).join(" / ")||`${p.instructor_label} (Not linked)`;
type Props={sectionId?:string;teacherId?:string;sections:Section[];teachers:Teacher[]};

export default function Grade12SchedulesInline({sectionId,teacherId,sections,teachers}:Props){
  const [term,setTerm]=useState<1|2>(1);
  const [rows,setRows]=useState<Period[]>([]);
  const [loaded,setLoaded]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [message,setMessage]=useState("");
  const [editing,setEditing]=useState<Period|null>(null);
  const [subject,setSubject]=useState("");
  const [instructorIds,setInstructorIds]=useState<string[]>([]);
  const [start,setStart]=useState("");
  const [end,setEnd]=useState("");
  const [janeEmail,setJaneEmail]=useState("");
  const [janePassword,setJanePassword]=useState("");

  async function reload(){
    const r=await fetch("/api/admin/grade12-term-program",{cache:"no-store"});
    const d=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(d.error||"Grade 12 schedules could not be loaded.");
    setRows(d.periods??[]);
    setCanProvision(Boolean(d.canProvision));
    const jane=(d.teachers??[]).find((t:Teacher&{email?:string})=>t.email==="jane.bardon.2026@temp.asuncion-nhs.invalid");
    if(jane)setJaneEmail("jane.bardon.2026@temp.asuncion-nhs.invalid");
  }
  useEffect(()=>{
    let active=true;
    const termParam=Number(new URLSearchParams(window.location.search).get("term"));
    if(termParam===2)setTerm(2);
    fetch("/api/admin/grade12-term-program",{cache:"no-store"})
      .then(async r=>{const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||"Failed to load Grade 12 schedules.");if(active){setRows(d.periods??[]);setCanProvision(Boolean(d.canProvision));setJaneEmail((d.teachers??[]).some((t:Teacher&{email?:string})=>t.email==="jane.bardon.2026@temp.asuncion-nhs.invalid")?"jane.bardon.2026@temp.asuncion-nhs.invalid":"");}})
      .catch(e=>{if(active)setError(e instanceof Error?e.message:"Unable to load Grade 12 schedules.");})
      .finally(()=>{if(active)setLoaded(true)});
    return()=>{active=false};
  },[]);

  const teacherMap=useMemo(()=>new Map(teachers.map(t=>[t.id,t.full_name])),[teachers]);
  const scope=useMemo(()=>rows.filter(p=>p.term_no===term && (teacherId ? p.instructor_ids?.includes(teacherId) : sectionId ? p.section_id===sectionId : false)).sort((a,b)=>a.day_of_week-b.day_of_week||a.start_time.localeCompare(b.start_time)),[rows,term,sectionId,teacherId]);
  const grouped=useMemo(()=>{
    const groups=new Map<string,Period[]>();
    for(const p of scope){const key=[p.section_id,p.subject_label,(p.instructor_ids??[]).join(",")].join("::");groups.set(key,[...(groups.get(key)??[]),p]);}
    return [...groups.values()].sort((a,b)=>a[0].subject_label.localeCompare(b[0].subject_label));
  },[scope]);
  const minutes=(s:string)=>Number(s.slice(0,2))*60+Number(s.slice(3,5));
  const weeklyHours=(scope.reduce((total,p)=>total+minutes(p.end_time)-minutes(p.start_time),0)/60).toFixed(1);
  function edit(p:Period){
    setEditing(p);setSubject(p.subject_label);setInstructorIds([...(p.instructor_ids ?? [])]);setStart(p.start_time.slice(0,5));setEnd(p.end_time.slice(0,5));setError("");setMessage("");
  }
  async function save(){
    if(!editing || busy)return;
    if(!subject.trim()||!start||!end||start>=end){setError("Check the subject and start/end time.");return;}
    setBusy(true);setError("");setMessage("");
    try{
      const response=await fetch("/api/admin/grade12-term-program",{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({action:"update_period",id:editing.id,subject_label:subject,instructor_ids:instructorIds.filter(Boolean),start_time:start,end_time:end})});
      const d=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(d.error||"Unable to save this period.");
      await reload();setEditing(null);setMessage("Class schedule saved for Term "+term+". The other term was not changed.");
    }catch(e){setError(e instanceof Error?e.message:"Unable to update this schedule.");}
    finally{setBusy(false);}
  }
  async function linkJane(){
    if(busy)return;setBusy(true);setError("");setMessage("");
    try{
      const response=await fetch("/api/admin/grade12-term-program",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"link_jane_bardon"})});
      const d=await response.json().catch(()=>({}));if(!response.ok)throw new Error(d.error||"Unable to link Jane Bardon.");
      await reload();setMessage(d.message||"Jane Bardon linked.");
    }catch(e){setError(e instanceof Error?e.message:"Teacher linking failed.");}
    finally{setBusy(false);}
  }
  async function createJane(){
    if(busy || !window.confirm("Create Jane Bardon's teaching account with a temporary email and one-time password? Her personal information and official position are not yet available."))return;
    setBusy(true);setError("");setMessage("");
    try{
      const response=await fetch("/api/admin/import-accounts",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
        action:"import",personType:"teacher",fileName:"Grade 12 Jane Bardon onboarding",rows:[{row_number:1,full_name:"JANE BARDON",email:"jane.bardon.2026@temp.asuncion-nhs.invalid",position:"Teacher",mobile:"",teacher_personal:{},teacher_official:{},source_data:{sheet:"Grade 12 Term 2",row:1}}]})});
      const d=await response.json().catch(()=>({}));if(!response.ok)throw new Error(d.error||"Unable to create a teacher account.");
      const credential=(d.accounts??[]).find((a:{identifier:string})=>a.identifier==="jane.bardon.2026@temp.asuncion-nhs.invalid");
      if(credential?.temporary_password){setJanePassword(credential.temporary_password);setJaneEmail(credential.identifier);}
      else throw new Error(d.errors?.[0]?.error||"Account response had no one-time password. Check Accounts before retrying.");
      const link=await fetch("/api/admin/grade12-term-program",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"link_jane_bardon"})});
      const ld=await link.json().catch(()=>({}));
      if(!link.ok)throw new Error(ld.error||"Account created, but schedule linking failed.");
      await reload();setMessage(ld.message||"Teacher created and linked.");
    }catch(e){setError(e instanceof Error?e.message:"Unable to create teacher account.");}
    finally{setBusy(false);}
  }
  function downloadCredentials(){
    if(!janePassword)return;
    const lines=["Name,Temporary Email,Temporary Password",["JANE BARDON",janeEmail,janePassword].map(s=>'"'+s.replaceAll('"','""')+'"').join(",")];
    const url=URL.createObjectURL(new Blob([lines.join("\n")],{type:"text/csv"}));
    const a=document.createElement("a");a.href=url;a.download="jane-bardon-temporary-credentials.csv";a.click();URL.revokeObjectURL(url);
  }
  const janeNeedsLink=scope.filter(p=>p.instructor_label==="JANE BARDON" && !p.instructor_ids?.length).length;
  const title=teacherId?"Teacher Schedule":"Quick Section Schedule";
  return <>
    <section className={`${styles.panel} ${styles.quickPanel}`}>
      <div className={styles.panelHeading}><div><h2>{title}</h2>
        <p>Grade 12 uses the same subject, teacher, day, and time layout as Junior High School. Choose the term to view or edit its class schedule.</p>
      </div></div>
      <div className={styles.quickPicker}>
        <label><span>School Term</span><select value={term} onChange={e=>{setTerm(Number(e.target.value) as 1|2);setMessage("");setError("");}}>
          <option value={1}>Term 1</option><option value={2}>Term 2</option>
        </select></label>
        <div className={styles.quickSummary}><strong>{grouped.length}</strong><span>Subject Loads</span><small>{scope.length} periods · {weeklyHours} hours/week</small></div>
      </div>
      {!loaded ? <div className={styles.quickEmpty}>Loading Grade 12 schedules…</div> :
       !sectionId && !teacherId ? <div className={styles.quickEmpty}>Select a Grade 12 section first.</div> :
       grouped.length===0 ? <div className={styles.quickEmpty}><CalendarDays size={26}/><strong>No schedule for this selection</strong><span>Choose another term or section.</span></div> :
       <div className={styles.quickRows}>
         {grouped.map(group=>{
           const p=group[0];
           return <article className={styles.quickRow} key={p.id}>
             <div className={styles.quickSubject}>
               <span>SUBJECT</span><strong>{p.subject_label}</strong>
               {teacherId && <small>Grade 12 · {sections.find(s=>s.id===p.section_id)?.name??p.source_sheet}</small>}
               <p>{originalName(p,teacherMap)}</p>
               {group.some(q=>q.needs_review)&&<small style={{color:"#a56b1f"}}>Review source timetable overlaps / unmatched fields</small>}
             </div>
             <div className={styles.quickDays}>
               <div className={styles.quickFieldLabel}><span>Days</span></div>
               <div className={styles.quickDayChoices}>
                 {[1,2,3,4,5].map(day=><button type="button" key={day} disabled className={group.some(q=>q.day_of_week===day)?styles.quickDaySelected:styles.quickDayChoice}>{shortDays[day-1]}</button>)}
               </div>
             </div>
             <div className={styles.quickTime}><span>Start</span><input aria-label="Scheduled start time" type="time" readOnly value={p.start_time.slice(0,5)}/></div>
             <div className={styles.quickTime}><span>End</span><input aria-label="Scheduled end time" type="time" readOnly value={p.end_time.slice(0,5)}/></div>
             <div className={styles.quickRoom}><span>Teacher</span><strong style={{fontSize:12,color:"#31566e"}}>{originalName(p,teacherMap)}</strong></div>
             <div className={styles.quickSave}><button type="button" onClick={()=>edit(p)} disabled={busy}><Pencil size={15}/>Edit</button></div>
             <div className={styles.quickExisting}><span>Current:</span>{group.map(item=><span key={item.id} className={styles.quickExistingEntry}>
               <button type="button" className={styles.quickExistingEdit} onClick={()=>edit(item)} title="Edit this day and time">
                 <strong>{shortDays[item.day_of_week-1]}</strong> {timeLabel(item.start_time)}–{timeLabel(item.end_time)}
               </button></span>)}</div>
           </article>
         })}
       </div>}
    </section>
    <section className={styles.panel}>
      <div className={styles.panelHeading}><div><h2>Selected {teacherId?"Teacher":"Section"} Schedule · Term {term}</h2>
        <p>Same schedule list as Grades 7–10. Edits apply only to this term. Original Excel records are preserved.</p>
      </div><button type="button" className={styles.secondary} disabled={busy} onClick={()=>void reload().catch(e=>setError(e instanceof Error?e.message:"Refresh failed."))}><RefreshCw size={16}/> Refresh</button></div>
      {!loaded ? <div className={styles.empty}>Loading…</div> : scope.length===0 ? <div className={styles.empty}>No periods found.</div> :
      <div className={styles.scheduleList}>{scope.map(p=><article className={styles.scheduleRow} key={p.id}>
        <div className={styles.dayBox}><CalendarDays size={18}/><strong>{weekdays[p.day_of_week-1]}</strong></div>
        <div><span>CLASS</span><strong>Grade 12 · {sections.find(s=>s.id===p.section_id)?.name??p.source_sheet}</strong><small>{p.subject_label}</small></div>
        <div><span>TEACHER</span><strong>{originalName(p,teacherMap)}</strong></div>
        <div><span>TIME</span><strong className={styles.inline}><Clock3 size={15}/>{timeLabel(p.start_time)} – {timeLabel(p.end_time)}</strong>
          {p.needs_review&&<small style={{color:"#986014"}}><AlertTriangle size={12}/> {p.review_reason||"Check timetable"}</small>}</div>
        <div className={styles.actions}><button type="button" className={styles.edit} disabled={busy} onClick={()=>edit(p)}><Pencil size={15}/> Edit</button></div>
      </article>)}</div>}
    </section>
    {(janeNeedsLink>0 || Boolean(janePassword)) && <section className={styles.panel} style={{padding:18}}>
      <strong>Jane Bardon · {janeNeedsLink} unmatched Second Term periods</strong>
      <p>Her teaching account can be created with a provisional email. The official address and personal details can be completed afterward.</p>
      {janeNeedsLink>0 && canProvision && <button className={styles.secondary} type="button" disabled={busy} onClick={()=>void (janeEmail?linkJane():createJane())}>{janeEmail?"Link Jane Bardon to Schedule":"Create Jane Bardon's Teacher Account"}</button>}
      {janeNeedsLink>0 && !canProvision && <small>Super Administrator access is required to create and link this account.</small>}
      {janePassword&&<><p>Temporary password: <code>{janePassword}</code></p><button type="button" onClick={downloadCredentials}>Download Temporary Credentials</button></>}
    </section>}
    {error&&<div className={styles.error} role="alert">{error}</div>}
    {message&&<div className={styles.success} role="status">{message}</div>}
    {editing&&<div role="presentation" style={{position:"fixed",inset:0,background:"rgba(13,33,51,.6)",display:"grid",placeItems:"center",zIndex:200,padding:12}}>
      <section role="dialog" aria-modal="true" aria-label="Edit Grade 12 schedule" className={styles.panel} style={{width:"min(530px,100%)",maxHeight:"90vh",overflowY:"auto",padding:22}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}><h2>Update Schedule · Term {term}</h2><button type="button" onClick={()=>setEditing(null)} aria-label="Close editor"><X size={20}/></button></div>
        <p>{sections.find(s=>s.id===editing.section_id)?.name} · {weekdays[editing.day_of_week-1]}</p>
        <label style={{display:"grid",gap:6,marginBottom:13}}>Subject<input value={subject} onChange={e=>setSubject(e.target.value)} style={{padding:10,border:"1px solid #cbdde5",borderRadius:8}}/></label>
        {editing.subject_label.includes("ORGANIC AGRICULTURE PRODUCTION/FOOD PROCESSING") ?
          <><label style={{display:"grid",gap:6,marginBottom:13}}>Organic Agriculture Production Teacher
            <select value={instructorIds[0]??""} onChange={e=>setInstructorIds([e.target.value,instructorIds[1]??""])}>
              <option value="">Select Teacher</option>{teachers.map(t=><option key={t.id} value={t.id}>{t.full_name}</option>)}
            </select></label>
            <label style={{display:"grid",gap:6,marginBottom:13}}>Food Processing Teacher
              <select value={instructorIds[1]??""} onChange={e=>setInstructorIds([instructorIds[0]??"",e.target.value])}>
                <option value="">Select Teacher</option>{teachers.map(t=><option key={t.id} value={t.id}>{t.full_name}</option>)}
              </select></label></>:
          <label style={{display:"grid",gap:6,marginBottom:13}}>Subject Teacher
            <select value={instructorIds[0]??""} onChange={e=>setInstructorIds(e.target.value?[e.target.value]:[])}>
              <option value="">Not yet assigned</option>{teachers.map(t=><option value={t.id} key={t.id}>{t.full_name}</option>)}
            </select></label>}
        <div style={{display:"flex",gap:12,marginBottom:14}}>
          <label style={{flex:1,display:"grid",gap:6}}>Start <input type="time" min="07:30" max="16:45" value={start} onChange={e=>setStart(e.target.value)}/></label>
          <label style={{flex:1,display:"grid",gap:6}}>End <input type="time" min="07:30" max="16:45" value={end} onChange={e=>setEnd(e.target.value)}/></label>
        </div>
        <p style={{fontSize:12,color:"#667c88"}}>The original Excel teacher was {editing.instructor_label}. Your change does not affect the other term.</p>
        <button className={styles.edit} type="button" disabled={busy||!subject.trim()||start>=end} onClick={()=>void save()}><Save size={16}/>{busy?"Saving…":"Save Schedule"}</button>
      </section>
    </div>}
  </>;
}
