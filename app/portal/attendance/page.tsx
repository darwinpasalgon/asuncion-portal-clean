"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CalendarOff,
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
type Student={id:string;full_name:string;lrn:string|null;last_name:string|null;first_name:string|null;middle_name:string|null;name_extension:string|null;sex:string|null};
type AttendanceStatus =
  | "present"
  | "absent"
  | "absent_morning"
  | "cutting_classes"
  | "transferred_in"
  | "transferred_out"
  | "dropped";
type RecordRow={id?:string;student_id:string;section_id:string;attendance_date:string;status:AttendanceStatus;note:string|null};
type Draft={status:AttendanceStatus|"";note:string};
type ExclusionType="regular_holiday"|"special_non_working_holiday"|"class_suspension";
type DateExclusion={id?:string;school_year_id:string;section_id:string;attendance_date:string;exclusion_type:ExclusionType;reason:string|null};
type PendingDate={section_id:string;grade_level:number;section:string;attendance_date:string;expected_count:number;recorded_count:number};
type AttendanceAssistant={id:string;school_year_id:string;section_id:string;student_id:string;assigned_by:string;is_active:boolean;assigned_at:string;updated_at:string};
type AssistantEntry={id?:string;school_year_id:string;section_id:string;attendance_date:string;student_id:string;status:"present"|"absent"|"absent_morning"|"cutting_classes";entered_by:string;updated_at?:string};
type AssistantRoster={school_year_id:string;section_id:string;student_id:string;display_name:string;sex:string|null};
type AssistantDraft={status:"present"|"absent"|"absent_morning"|"cutting_classes"|""};

function localDate(){
  const d=new Date();
  const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,"0"),day=String(d.getDate()).padStart(2,"0");
  return y+"-"+m+"-"+day;
}

function formatDate(value:string){
  const d=new Date(value+"T00:00:00");
  return d.toLocaleDateString([], {year:"numeric",month:"short",day:"numeric",weekday:"short"});
}

const ATTENDANCE_LABELS:Record<AttendanceStatus,string>={
  present:"Present",
  absent:"Absent",
  absent_morning:"Absent in the Morning",
  cutting_classes:"Cutting Classes",
  transferred_in:"Transferred In",
  transferred_out:"Transferred Out",
  dropped:"Dropped",
};

const NO_CLASS_LABELS:Record<ExclusionType,string>={
  regular_holiday:"Regular Holiday",
  special_non_working_holiday:"Special Non-Working Holiday",
  class_suspension:"Suspension of Classes",
};

function isWeekday(value:string){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
  const day=new Date(value+"T12:00:00Z").getUTCDay();
  return day>=1&&day<=5;
}

function sexGroup(value:string|null){
  const normalized=(value??"").trim().toLowerCase();
  if(normalized==="m"||normalized==="male")return "Male";
  if(normalized==="f"||normalized==="female")return "Female";
  return "Unspecified";
}

function compareStudents(a:Student,b:Student){
  const rank=(value:string|null)=>{
    const group=sexGroup(value);
    return group==="Male"?0:group==="Female"?1:2;
  };
  const bySex=rank(a.sex)-rank(b.sex);
  if(bySex!==0)return bySex;

  const byLast=(a.last_name??"").localeCompare(b.last_name??"",undefined,{sensitivity:"base"});
  if(byLast!==0)return byLast;

  const byFirst=(a.first_name??"").localeCompare(b.first_name??"",undefined,{sensitivity:"base"});
  if(byFirst!==0)return byFirst;

  return a.full_name.localeCompare(b.full_name,undefined,{sensitivity:"base"});
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
  const [dateExclusions,setDateExclusions]=useState<DateExclusion[]>([]);
  const [pendingDates,setPendingDates]=useState<PendingDate[]>([]);
  const [attendanceAssistants,setAttendanceAssistants]=useState<AttendanceAssistant[]>([]);
  const [assistantEntries,setAssistantEntries]=useState<AssistantEntry[]>([]);
  const [assistantAssignment,setAssistantAssignment]=useState<AttendanceAssistant|null>(null);
  const [assistantRoster,setAssistantRoster]=useState<AssistantRoster[]>([]);
  const [assistantExclusions,setAssistantExclusions]=useState<DateExclusion[]>([]);
  const [assistantDate,setAssistantDate]=useState(localDate());
  const [assistantDrafts,setAssistantDrafts]=useState<Record<string,AssistantDraft>>({});
  const [assistantCandidateId,setAssistantCandidateId]=useState("");
  const [assistantWorking,setAssistantWorking]=useState(false);
  const [date,setDate]=useState(localDate());
  const [sectionId,setSectionId]=useState("");
  const [drafts,setDrafts]=useState<Record<string,Draft>>({});
  const [noClassType,setNoClassType]=useState<ExclusionType|"">("");
  const [noClassReason,setNoClassReason]=useState("");
  const [loading,setLoading]=useState(true);
  const [working,setWorking]=useState(false);
  const [calendarWorking,setCalendarWorking]=useState(false);
  const [error,setError]=useState("");
  const [success,setSuccess]=useState("");

  async function load(targetDate=date,targetSectionId=sectionId){
    setLoading(true);setError("");
    try{
      const r=await fetch("/api/academic/attendance?date="+encodeURIComponent(targetDate),{cache:"no-store"});
      const x=await r.json().catch(()=>({}));
      if(!r.ok){setError(x.error??"Unable to load attendance.");return;}
      setRole(x.role??null);setProfile(x.profile??null);setActiveYear(x.activeYear??null);
      setAdvisers(x.advisers??[]);setSections(x.sections??[]);setEnrollments(x.enrollments??[]);
      setStudents(x.students??[]);setAttendance(x.attendance??[]);
      setDateExclusions(x.dateExclusions??[]);setPendingDates(x.pendingDates??[]);
      setAttendanceAssistants(x.attendanceAssistants??[]);
      setAssistantEntries(x.assistantEntries??[]);
      setAssistantAssignment(x.assistantAssignment??null);
      setAssistantRoster(x.assistantRoster??[]);
      setAssistantExclusions(x.assistantExclusions??[]);
      setAssistantDate(x.assistantDate??localDate());
      if(x.role==="teacher"){
        const requested=targetSectionId&&x.sections?.some((item:Section)=>item.id===targetSectionId)
          ? targetSectionId
          : x.sections?.[0]?.id??"";
        if(requested)setSectionId(requested);
      }
    }catch{setError("Unable to reach the attendance service.");}
    finally{setLoading(false);}
  }

  useEffect(()=>{
    const params=typeof window!=="undefined"?new URLSearchParams(window.location.search):null;
    const requestedDate=params?.get("date")||localDate();
    const requestedSection=params?.get("section")||"";
    setDate(requestedDate);
    void load(requestedDate,requestedSection);
  },[]);

  const studentMap=useMemo(()=>new Map(students.map(s=>[s.id,s])),[students]);
  const selectedSection=sections.find(s=>s.id===sectionId);
  const roster=useMemo(()=>{
    if(role!=="teacher"||!sectionId)return [];
    return enrollments
      .filter(e=>e.section_id===sectionId)
      .map(e=>studentMap.get(e.student_id))
      .filter((s):s is Student=>Boolean(s))
      .sort(compareStudents);
  },[role,sectionId,enrollments,studentMap]);

  const rosterGroups=useMemo(
    ()=>["Male","Female","Unspecified"].map(group=>({
      group,
      students:roster.filter(student=>sexGroup(student.sex)===group),
    })).filter(item=>item.students.length>0),
    [roster]
  );

  useEffect(()=>{
    if(role!=="teacher"||!sectionId)return;
    const next:Record<string,Draft>={};
    for(const student of roster){
      const existing=attendance.find(a=>a.student_id===student.id&&a.section_id===sectionId);
      const assistant=assistantEntries.find(a=>a.student_id===student.id&&a.section_id===sectionId&&a.attendance_date===date);
      next[student.id]={status:existing?.status??assistant?.status??"",note:existing?.note??""};
    }
    setDrafts(next);
  },[role,sectionId,roster,attendance,assistantEntries,date]);

  function markAllPresent(){
    const next:Record<string,Draft>={};
    for(const s of roster)next[s.id]={status:"present",note:drafts[s.id]?.note??""};
    setDrafts(next);
  }

  useEffect(()=>{
    if(role!=="student"||!assistantAssignment)return;
    const next:Record<string,AssistantDraft>={};
    for(const student of assistantRoster){
      const existing=assistantEntries.find(
        entry=>entry.student_id===student.student_id&&
          entry.section_id===assistantAssignment.section_id&&
          entry.attendance_date===assistantDate
      );
      next[student.student_id]={status:existing?.status??""};
    }
    setAssistantDrafts(next);
  },[role,assistantAssignment,assistantRoster,assistantEntries,assistantDate]);

  function markAssistantAllPresent(){
    const next:Record<string,AssistantDraft>={};
    for(const student of assistantRoster)next[student.student_id]={status:"present"};
    setAssistantDrafts(next);
  }

  function updateAssistantDraft(studentId:string,status:"present"|"absent"|"absent_morning"|"cutting_classes"|""){
    setAssistantDrafts(current=>({...current,[studentId]:{status}}));
  }

  async function assignAttendanceAssistant(){
    if(!sectionId||!assistantCandidateId)return;
    setAssistantWorking(true);setError("");setSuccess("");
    try{
      const r=await fetch("/api/academic/attendance",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          action:"assign_attendance_assistant",
          sectionId,
          studentId:assistantCandidateId,
        }),
      });
      const x=await r.json().catch(()=>({}));
      if(!r.ok){setError(x.error??"Unable to assign Attendance Assistant.");return;}
      setAssistantCandidateId("");
      setSuccess("Attendance Assistant assigned.");
      await load(date,sectionId);
    }catch{setError("Unable to reach the attendance service.");}
    finally{setAssistantWorking(false);}
  }

  async function removeAttendanceAssistant(assistantId:string){
    if(!sectionId)return;
    setAssistantWorking(true);setError("");setSuccess("");
    try{
      const r=await fetch("/api/academic/attendance",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          action:"remove_attendance_assistant",
          sectionId,
          assistantId,
        }),
      });
      const x=await r.json().catch(()=>({}));
      if(!r.ok){setError(x.error??"Unable to remove Attendance Assistant.");return;}
      setSuccess("Attendance Assistant removed.");
      await load(date,sectionId);
    }catch{setError("Unable to reach the attendance service.");}
    finally{setAssistantWorking(false);}
  }

  async function saveAssistantAttendance(){
    if(!assistantAssignment||!assistantRoster.length)return;
    setAssistantWorking(true);setError("");setSuccess("");
    try{
      const r=await fetch("/api/academic/attendance",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          action:"save_assistant_attendance",
          sectionId:assistantAssignment.section_id,
          attendanceDate:assistantDate,
          records:assistantRoster.map(student=>({
            studentId:student.student_id,
            status:assistantDrafts[student.student_id]?.status??"",
          })),
        }),
      });
      const x=await r.json().catch(()=>({}));
      if(!r.ok){setError(x.error??"Unable to submit attendance to your adviser.");return;}
      setSuccess("Attendance draft submitted to your adviser for review.");
      await load(assistantDate,assistantAssignment.section_id);
    }catch{setError("Unable to reach the attendance service.");}
    finally{setAssistantWorking(false);}
  }

  function update(studentId:string,field:keyof Draft,value:string){
    setDrafts(cur=>({
      ...cur,
      [studentId]:{
        ...(cur[studentId]??{status:"",note:""}),
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
            status:drafts[s.id]?.status??"",
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

  const selectedExclusion=dateExclusions.find(
    item=>item.section_id===sectionId&&item.attendance_date===date
  );
  const selectedIsWeekday=isWeekday(date);
  const untaggedCount=roster.filter(student=>!drafts[student.id]?.status).length;
  const currentAssistants=attendanceAssistants.filter(item=>item.section_id===sectionId&&item.is_active);
  const currentAssistantEntries=assistantEntries.filter(item=>item.section_id===sectionId&&item.attendance_date===date);
  const assistantIds=new Set(currentAssistants.map(item=>item.student_id));
  const assistantCandidates=roster.filter(student=>!assistantIds.has(student.id));
  const assistantUntaggedCount=assistantRoster.filter(
    student=>!assistantDrafts[student.student_id]?.status
  ).length;
  const assistantSection=assistantAssignment
    ? sections.find(section=>section.id===assistantAssignment.section_id)
    : null;
  const assistantNoClasses=assistantExclusions.length>0;

  function openPending(item:PendingDate){
    setSectionId(item.section_id);
    setDate(item.attendance_date);
    setSuccess("");
    setError("");
    void load(item.attendance_date,item.section_id);
    if(typeof window!=="undefined"){
      const url=new URL(window.location.href);
      url.searchParams.set("date",item.attendance_date);
      url.searchParams.set("section",item.section_id);
      window.history.replaceState(null,"",url.toString());
    }
  }

  async function markNoClasses(){
    if(!sectionId||!noClassType||!selectedIsWeekday)return;
    setCalendarWorking(true);setError("");setSuccess("");
    try{
      const r=await fetch("/api/academic/attendance",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          action:"mark_no_classes",
          sectionId,
          attendanceDate:date,
          exclusionType:noClassType,
          reason:noClassReason,
        }),
      });
      const x=await r.json().catch(()=>({}));
      if(!r.ok){setError(x.error??"Unable to mark this date as No Classes.");return;}
      setSuccess(formatDate(date)+" marked as "+NO_CLASS_LABELS[noClassType]+".");
      setNoClassType("");setNoClassReason("");
      await load(date,sectionId);
    }catch{setError("Unable to reach the attendance service.");}
    finally{setCalendarWorking(false);}
  }

  async function restoreSchoolDay(){
    if(!sectionId||!selectedExclusion)return;
    setCalendarWorking(true);setError("");setSuccess("");
    try{
      const r=await fetch("/api/academic/attendance",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          action:"restore_school_day",
          sectionId,
          attendanceDate:date,
        }),
      });
      const x=await r.json().catch(()=>({}));
      if(!r.ok){setError(x.error??"Unable to restore this school day.");return;}
      setSuccess(formatDate(date)+" restored as a school day.");
      await load(date,sectionId);
    }catch{setError("Unable to reach the attendance service.");}
    finally{setCalendarWorking(false);}
  }

  const counts=useMemo(()=>{
    const rows=role==="student"?attendance:attendance.filter(a=>a.section_id===sectionId);
    return {
      total:rows.length,
      present:rows.filter(a=>a.status==="present").length,
      absent:rows.filter(a=>a.status==="absent").length,
      absentMorning:rows.filter(a=>a.status==="absent_morning").length,
      cutting:rows.filter(a=>a.status==="cutting_classes").length,
      transferredIn:rows.filter(a=>a.status==="transferred_in").length,
      transferredOut:rows.filter(a=>a.status==="transferred_out").length,
      dropped:rows.filter(a=>a.status==="dropped").length,
    };
  },[role,attendance,sectionId]);

  if(loading)return <main className={styles.loading}><ClipboardCheck size={34}/><strong>Loading Attendance…</strong></main>;

  return <main className={styles.page}><div className={styles.shell}>
    <nav className={styles.topActions}>
      <a href="/portal" className={styles.topLink}><ArrowLeft size={16}/>Back to Portal</a>
    </nav>

    <header className={styles.header}>
      <div>
        <span className={styles.eyebrow}>ACADEMIC RECORDS</span>
        <h1>{role==="teacher"?"Daily Attendance":assistantAssignment?"Attendance Assistant":"My Attendance"}</h1>
        <p>{role==="teacher"
          ?"Record daily section attendance for sections assigned to you as Attendance Teacher / Adviser."
          :assistantAssignment
            ?"Mark your classmates Present, Absent, Absent in the Morning, or Cutting Classes for today. Your adviser reviews and saves the official attendance."
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
          <strong>No Adviser Section Assigned</strong>
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
            <label><span>Date</span><input type="date" value={date} max={localDate()} onChange={e=>setDate(e.target.value)}/></label>
            <button className={styles.loadButton} onClick={()=>void load(date)}><CalendarDays size={16}/>Load Date</button>
          </section>

          <section className={styles.assistantManager}>
            <div className={styles.assistantManagerHeading}>
              <div>
                <UserCheck size={19}/>
                <div>
                  <strong>Attendance Assistants</strong>
                  <span>Assign 2 or 3 students from this advisory section.</span>
                </div>
              </div>
              <span>{currentAssistants.length}/3</span>
            </div>
            <div className={styles.assistantManagerBody}>
              <div className={styles.assistantAssign}>
                <select
                  value={assistantCandidateId}
                  disabled={assistantWorking||currentAssistants.length>=3}
                  onChange={e=>setAssistantCandidateId(e.target.value)}
                >
                  <option value="">{currentAssistants.length>=3?"Maximum of 3 assistants assigned":"Select Student"}</option>
                  {assistantCandidates.map(student=><option key={student.id} value={student.id}>{student.full_name}</option>)}
                </select>
                <button
                  type="button"
                  disabled={assistantWorking||!assistantCandidateId||currentAssistants.length>=3}
                  onClick={()=>void assignAttendanceAssistant()}
                >
                  <UserCheck size={15}/>Assign Assistant
                </button>
              </div>
              <div className={styles.assistantList}>
                {currentAssistants.length===0
                  ?<span className={styles.assistantEmpty}>No Attendance Assistants assigned yet.</span>
                  :currentAssistants.map(item=>{
                    const student=studentMap.get(item.student_id);
                    return <div key={item.id} className={styles.assistantChip}>
                      <div><strong>{student?.full_name??"Student"}</strong><small>Can submit attendance drafts for this section</small></div>
                      <button type="button" disabled={assistantWorking} onClick={()=>void removeAttendanceAssistant(item.id)}>Remove</button>
                    </div>;
                  })}
              </div>
            </div>
          </section>

          {pendingDates.length>0&&<section className={styles.pendingPanel}>
            <div className={styles.pendingHeading}>
              <div>
                <AlertTriangle size={19}/>
                <div>
                  <strong>Unrecorded Weekdays</strong>
                  <span>Record attendance or mark the date as No Classes.</span>
                </div>
              </div>
              <span className={styles.pendingCount}>{pendingDates.length}</span>
            </div>
            <div className={styles.pendingList}>
              {pendingDates.slice(0,12).map(item=><button
                type="button"
                key={item.section_id+"-"+item.attendance_date}
                className={styles.pendingDate}
                onClick={()=>openPending(item)}
              >
                <div>
                  <strong>{formatDate(item.attendance_date)}</strong>
                  <span>{"Grade "+item.grade_level+" · "+item.section}</span>
                  <small>{item.recorded_count===0
                    ?"No attendance tagged"
                    :item.recorded_count+" of "+item.expected_count+" learner records tagged"}</small>
                </div>
                <ArrowRight size={16}/>
              </button>)}
            </div>
            {pendingDates.length>12&&<div className={styles.pendingMore}>
              Showing the 12 most recent dates. Older unrecorded weekdays remain tracked.
            </div>}
          </section>}

          {!selectedIsWeekday&&<section className={styles.weekendNotice}>
            <CalendarOff size={20}/>
            <div>
              <strong>No Attendance Required</strong>
              <span>Attendance is recorded Monday to Friday only. Weekend dates are not included.</span>
            </div>
          </section>}

          {selectedIsWeekday&&selectedExclusion&&<section className={styles.noClassesBanner}>
            <CalendarOff size={21}/>
            <div>
              <span>NO CLASSES</span>
              <strong>{NO_CLASS_LABELS[selectedExclusion.exclusion_type]}</strong>
              <p>{selectedExclusion.reason||"No additional reason provided."}</p>
            </div>
            <button disabled={calendarWorking} onClick={()=>void restoreSchoolDay()}>
              {calendarWorking?"Restoring…":"Restore as School Day"}
            </button>
          </section>}

          {selectedIsWeekday&&!selectedExclusion&&<details className={styles.noClassesControl}>
            <summary><CalendarOff size={17}/>Mark This Date as No Classes</summary>
            <div className={styles.noClassesForm}>
              <label>
                <span>Type</span>
                <select value={noClassType} onChange={e=>setNoClassType(e.target.value as ExclusionType|"")}>
                  <option value="">Select Type</option>
                  <option value="regular_holiday">Regular Holiday</option>
                  <option value="special_non_working_holiday">Special Non-Working Holiday</option>
                  <option value="class_suspension">Suspension of Classes</option>
                </select>
              </label>
              <label className={styles.reasonField}>
                <span>Reason (Optional)</span>
                <input
                  maxLength={300}
                  placeholder="Example: Flood, typhoon, local suspension"
                  value={noClassReason}
                  onChange={e=>setNoClassReason(e.target.value)}
                />
              </label>
              <button disabled={calendarWorking||!noClassType} onClick={()=>void markNoClasses()}>
                <CalendarOff size={16}/>{calendarWorking?"Saving…":"Mark as No Classes"}
              </button>
            </div>
          </details>}

          {selectedIsWeekday&&!selectedExclusion&&<section className={styles.panel}>
            <div className={styles.panelHeading}>
              <div>
                <h2>{selectedSection?("Grade "+selectedSection.grade_level+" · "+selectedSection.name):"Attendance Sheet"}</h2>
                <p>{formatDate(date)+" · "+roster.length+" enrolled student"+(roster.length===1?"":"s")}</p>
              </div>
              <div className={styles.actions}>
                <button className={styles.markAll} onClick={markAllPresent}><CheckCircle2 size={16}/>Mark All Present</button>
                <button className={styles.saveAll} disabled={working||!roster.length||untaggedCount>0} onClick={()=>void save()}><Save size={16}/>{working?"Saving…":"Save Attendance"}</button>
              </div>
            </div>

            {currentAssistantEntries.length>0&&<div className={styles.assistantDraftNotice}>
              <UserCheck size={16}/>
              <span>
                Attendance Assistants submitted {currentAssistantEntries.length} attendance mark{currentAssistantEntries.length===1?"":"s"} for this date. Their marks are prefilled only where no official adviser record exists. Review before saving.
              </span>
            </div>}

            {untaggedCount>0&&<div className={styles.untaggedNotice}>
              <AlertTriangle size={16}/>
              <span>
                {untaggedCount+" learner"+(untaggedCount===1?"":"s")+" still need an attendance tag before this date can be saved."}
              </span>
            </div>}

            {roster.length===0
              ?<div className={styles.empty}>No active students are enrolled in this section.</div>
              :<div className={styles.roster}>
                {rosterGroups.map(({group,students:groupStudents})=>{
                  const startIndex=roster.findIndex(student=>student.id===groupStudents[0]?.id);
                  return <section className={styles.sexGroup} key={group}>
                    <div className={styles.sexGroupHeading}>
                      <strong>{group}</strong>
                      <span>{groupStudents.length} learner{groupStudents.length===1?"":"s"}</span>
                    </div>
                    {groupStudents.map((student,index)=>{
                      const d=drafts[student.id]??{status:"",note:""};
                      return <article key={student.id}>
                        <div className={styles.student}>
                          <span>{startIndex+index+1}</span>
                          <div>
                            <strong>{student.full_name}</strong>
                            <small>
                              {(student.last_name&&student.first_name
                                ? student.last_name+", "+student.first_name+
                                  (student.middle_name?(" "+student.middle_name):"")+
                                  (student.name_extension?(" "+student.name_extension):"")
                                : student.full_name)}
                              {student.lrn?(" · LRN "+student.lrn):""}
                            </small>
                          </div>
                        </div>
                        <select className={d.status?styles[d.status]:styles.untagged} value={d.status} onChange={e=>update(student.id,"status",e.target.value)}>
                          <option value="">Select Attendance</option>
                          <option value="present">Present</option>
                          <option value="absent">Absent</option>
                          <option value="absent_morning">Absent in the Morning</option>
                          <option value="cutting_classes">Cutting Classes</option>
                          <option value="transferred_in">Transferred In</option>
                          <option value="transferred_out">Transferred Out</option>
                          <option value="dropped">Dropped</option>
                        </select>
                        <input maxLength={300} placeholder="Optional note" value={d.note} onChange={e=>update(student.id,"note",e.target.value)}/>
                      </article>;
                    })}
                  </section>;
                })}
              </div>}
          </section>}
        </>}
    </>}

    {role==="student"&&<>
      {assistantAssignment&&<section className={styles.assistantStudentPanel}>
        <div className={styles.panelHeading}>
          <div>
            <h2>{"Attendance Assistant · "+(assistantSection?("Grade "+assistantSection.grade_level+" · "+assistantSection.name):"Your Section")}</h2>
            <p>{formatDate(assistantDate)+" · Adviser approval required"}</p>
          </div>
          {!assistantNoClasses&&isWeekday(assistantDate)&&<div className={styles.actions}>
            <button className={styles.markAll} onClick={markAssistantAllPresent}><CheckCircle2 size={16}/>Mark All Present</button>
            <button
              className={styles.saveAll}
              disabled={assistantWorking||!assistantRoster.length||assistantUntaggedCount>0}
              onClick={()=>void saveAssistantAttendance()}
            >
              <Save size={16}/>{assistantWorking?"Submitting…":"Submit to Adviser"}
            </button>
          </div>}
        </div>

        {!isWeekday(assistantDate)&&<div className={styles.weekendNotice}>
          <CalendarOff size={20}/><div><strong>No Attendance Required</strong><span>Attendance Assistants can submit on school weekdays only.</span></div>
        </div>}
        {assistantNoClasses&&<div className={styles.noClassesBanner}>
          <CalendarOff size={20}/><div><span>NO CLASSES</span><strong>Attendance entry is disabled for today.</strong></div>
        </div>}
        {!assistantNoClasses&&isWeekday(assistantDate)&&<>
          {assistantUntaggedCount>0&&<div className={styles.untaggedNotice}>
            <AlertTriangle size={16}/>
            <span>{assistantUntaggedCount+" classmate"+(assistantUntaggedCount===1?"":"s")+" still need an attendance mark."}</span>
          </div>}
          <div className={styles.assistantRoster}>
            {assistantRoster.map((student,index)=>{
              const d=assistantDrafts[student.student_id]??{status:""};
              return <article key={student.student_id}>
                <div className={styles.student}>
                  <span>{index+1}</span>
                  <div><strong>{student.display_name}</strong><small>{sexGroup(student.sex)}</small></div>
                </div>
                <div className={styles.assistantStatusButtons}>
                  <button type="button" className={d.status==="present"?styles.assistantPresent:""} onClick={()=>updateAssistantDraft(student.student_id,"present")}>Present</button>
                  <button type="button" className={d.status==="absent"?styles.assistantAbsent:""} onClick={()=>updateAssistantDraft(student.student_id,"absent")}>Absent</button>
                  <button type="button" className={d.status==="absent_morning"?styles.assistantAbsentMorning:""} onClick={()=>updateAssistantDraft(student.student_id,"absent_morning")}>Absent in the Morning</button>
                  <button type="button" className={d.status==="cutting_classes"?styles.assistantCutting:""} onClick={()=>updateAssistantDraft(student.student_id,"cutting_classes")}>Cutting Classes</button>
                </div>
              </article>;
            })}
          </div>
          <div className={styles.assistantDisclaimer}>
            These are draft marks only. Your adviser remains responsible for the official attendance record and can correct any entry.
          </div>
        </>}
      </section>}

      <div className={styles.summary}>
        <article><ClipboardCheck size={22}/><span>Recorded Days</span><strong>{counts.total}</strong></article>
        <article><CheckCircle2 size={22}/><span>Present</span><strong>{counts.present}</strong></article>
        <article><XCircle size={22}/><span>Absent</span><strong>{counts.absent}</strong></article>
        <article><Clock3 size={22}/><span>Absent in the Morning</span><strong>{counts.absentMorning}</strong></article>
        <article><XCircle size={22}/><span>Cutting Classes</span><strong>{counts.cutting}</strong></article>
        <article><UserCheck size={22}/><span>Movement</span><strong>{counts.transferredIn+" / "+counts.transferredOut+" / "+counts.dropped}</strong><small>Transferred In / Out / Dropped</small></article>
      </div>

      <section className={styles.panel}>
        <div className={styles.panelHeading}><div><h2>Attendance History</h2><p>{(profile?.full_name??"Student")+" · latest recorded school days"}</p></div></div>
        {attendance.length===0
          ?<div className={styles.empty}>No attendance records have been recorded for you yet.</div>
          :<div className={styles.history}>
            {attendance.map((a,i)=><article key={a.id??i}>
              <div><strong>{formatDate(a.attendance_date)}</strong><small>{a.note||"No note"}</small></div>
              <span className={styles[a.status]}>{ATTENDANCE_LABELS[a.status]}</span>
            </article>)}
          </div>}
      </section>
    </>}
  </div></main>;
}
