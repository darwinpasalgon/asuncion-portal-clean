"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Archive,
  ArrowLeft,
  Bell,
  CheckCircle2,
  FileImage,
  FileText,
  Megaphone,
  Send,
  ShieldCheck,
} from "lucide-react";
import styles from "./announcements.module.css";

type Role="student"|"teacher"|"administrator";
type Profile={id:string;full_name:string;role:Role};
type Year={id:string;name:string};
type Grade={grade_level:number;label:string};
type Section={id:string;grade_level:number;name:string};
type Announcement={
  id:string;
  announcement_type:"announcement"|"memorandum";
  title:string;
  body:string|null;
  memo_number:string|null;
  memo_date:string|null;
  audience_scope:"school"|"grade"|"section";
  target_grade:number|null;
  target_section_id:string|null;
  status:"draft"|"published"|"archived";
  published_at:string|null;
  expires_at:string|null;
  created_by:string;
  posted_by_name:string;
  attachment_name:string|null;
  attachment_mime_type:string|null;
  attachment_size:number|null;
  created_at:string;
};

function dateLabel(value:string|null){
  if(!value)return "";
  return new Date(value).toLocaleDateString([], {year:"numeric",month:"short",day:"numeric"});
}

function fileSize(size:number|null){
  if(!size)return "";
  if(size<1024*1024)return Math.max(1,Math.round(size/1024))+" KB";
  return (size/(1024*1024)).toFixed(1)+" MB";
}

export default function AnnouncementsPage(){
  const [profile,setProfile]=useState<Profile|null>(null);
  const [activeYear,setActiveYear]=useState<Year|null>(null);
  const [announcements,setAnnouncements]=useState<Announcement[]>([]);
  const [grades,setGrades]=useState<Grade[]>([]);
  const [sections,setSections]=useState<Section[]>([]);
  const [allowedSections,setAllowedSections]=useState<Section[]>([]);
  const [announcementType,setAnnouncementType]=useState<"announcement"|"memorandum">("announcement");
  const [audienceScope,setAudienceScope]=useState<"school"|"grade"|"section">("school");
  const [loading,setLoading]=useState(true);
  const [working,setWorking]=useState("");
  const [error,setError]=useState("");
  const [success,setSuccess]=useState("");

  async function load(){
    setLoading(true); setError("");
    try{
      const r=await fetch("/api/announcements",{cache:"no-store"});
      const x=await r.json().catch(()=>({}));
      if(!r.ok){setError(x.error??"Unable to load announcements.");return;}
      setProfile(x.profile??null);
      setActiveYear(x.activeYear??null);
      setAnnouncements(x.announcements??[]);
      setGrades(x.grades??[]);
      setSections(x.sections??[]);
      setAllowedSections(x.allowedSections??[]);
      if(x.profile?.role==="teacher")setAudienceScope("section");
    }catch{setError("Unable to reach the announcements service.");}
    finally{setLoading(false);}
  }

  useEffect(()=>{void load();},[]);

  const canPost=profile?.role==="teacher"||profile?.role==="administrator";
  const isAdmin=profile?.role==="administrator";

  const sectionMap=useMemo(()=>new Map(sections.map(s=>[s.id,s])),[sections]);

  function audienceLabel(item:Announcement){
    if(item.audience_scope==="school")return "Entire school";
    if(item.audience_scope==="grade")return "Grade "+item.target_grade;
    const section=item.target_section_id?sectionMap.get(item.target_section_id):null;
    return section?("Grade "+section.grade_level+" · "+section.name):"Section";
  }

  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    const form=event.currentTarget;
    const data=new FormData(form);
    data.set("announcementType",isAdmin?announcementType:"announcement");
    data.set("audienceScope",profile?.role==="teacher"?"section":audienceScope);

    const expiresLocal=String(data.get("expiresAt")??"");
    if(expiresLocal){
      const expiresDate=new Date(expiresLocal);
      if(!Number.isNaN(expiresDate.getTime())){
        data.set("expiresAt",expiresDate.toISOString());
      }
    }

    setWorking("create");setError("");setSuccess("");
    try{
      const r=await fetch("/api/announcements",{method:"POST",body:data});
      const x=await r.json().catch(()=>({}));
      if(!r.ok){setError(x.error??"Unable to create the announcement.");return;}
      setSuccess((isAdmin&&announcementType==="memorandum"?"Memorandum":"Announcement")+" created successfully.");
      form.reset();
      setAnnouncementType("announcement");
      if(isAdmin)setAudienceScope("school");
      await load();
    }catch{setError("Unable to reach the announcements service.");}
    finally{setWorking("");}
  }

  async function updateStatus(id:string,action:"publish"|"draft"|"archive"){
    setWorking(id);setError("");setSuccess("");
    try{
      const r=await fetch("/api/announcements",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({action,id}),
      });
      const x=await r.json().catch(()=>({}));
      if(!r.ok){setError(x.error??"Unable to update the announcement.");return;}
      setSuccess(action==="publish"?"Published.":action==="draft"?"Returned to draft.":"Archived.");
      await load();
    }catch{setError("Unable to reach the announcements service.");}
    finally{setWorking("");}
  }

  return <main className={styles.page}><div className={styles.shell}>
    <nav className={styles.topActions}>
      <a href="/portal" className={styles.topLink}><ArrowLeft size={16}/>Back to portal</a>
    </nav>

    <header className={styles.header}>
      <div>
        <span className={styles.eyebrow}>SCHOOL COMMUNICATIONS</span>
        <h1>Announcements</h1>
        <p>School announcements, section notices, and official memorandums for the Asuncion NHS community.</p>
      </div>
      {activeYear&&<div className={styles.yearCard}><CheckCircle2 size={18}/><div><span>SCHOOL YEAR</span><strong>{activeYear.name}</strong></div></div>}
    </header>

    {error&&<div className={styles.error}>{error}</div>}
    {success&&<div className={styles.success}>{success}</div>}

    {canPost&&<section className={styles.composer}>
      <div className={styles.composerHead}>
        <div>
          <span>{isAdmin?"ADMINISTRATOR / PRINCIPAL":"TEACHER"}</span>
          <h2>Create a post</h2>
          <p>{isAdmin
            ?"Publish a school announcement or upload an official memorandum."
            :"Post an announcement to one of your assigned sections."}</p>
        </div>
        <Megaphone size={27}/>
      </div>

      <form onSubmit={submit} className={styles.form}>
        {isAdmin&&<div className={styles.typeTabs}>
          <button type="button" className={announcementType==="announcement"?styles.typeActive:styles.typeButton} onClick={()=>setAnnouncementType("announcement")}><Bell size={16}/>Announcement</button>
          <button type="button" className={announcementType==="memorandum"?styles.typeActive:styles.typeButton} onClick={()=>setAnnouncementType("memorandum")}><FileText size={16}/>Memorandum</button>
        </div>}

        <div className={styles.formGrid}>
          <label className={styles.wide}>
            <span>Title</span>
            <input name="title" required minLength={2} maxLength={180} placeholder={announcementType==="memorandum"?"e.g. Memorandum on School Activity":"e.g. Important school announcement"}/>
          </label>

          {isAdmin&&announcementType==="memorandum"&&<>
            <label><span>Memo number <small>optional</small></span><input name="memoNumber" maxLength={80} placeholder="e.g. Memo No. 12, s. 2026"/></label>
            <label><span>Memo date <small>optional</small></span><input name="memoDate" type="date"/></label>
          </>}

          <label className={styles.wide}>
            <span>{announcementType==="memorandum"?"Summary / message":"Message"} <small>optional</small></span>
            <textarea name="body" maxLength={10000} rows={5} placeholder="Write the details here..."/>
          </label>

          {isAdmin
            ?<label>
              <span>Audience</span>
              <select name="audienceScope" value={audienceScope} onChange={e=>setAudienceScope(e.target.value as "school"|"grade"|"section")}>
                <option value="school">Entire school</option>
                <option value="grade">Specific grade level</option>
                <option value="section">Specific section</option>
              </select>
            </label>
            :<input type="hidden" name="audienceScope" value="section"/>}

          {isAdmin&&audienceScope==="grade"&&<label>
            <span>Grade level</span>
            <select name="targetGrade" required defaultValue="">
              <option value="" disabled>Select grade</option>
              {grades.map(g=><option key={g.grade_level} value={g.grade_level}>{g.label}</option>)}
            </select>
          </label>}

          {(audienceScope==="section"||profile?.role==="teacher")&&<label>
            <span>Section</span>
            <select name="targetSectionId" required defaultValue="">
              <option value="" disabled>Select section</option>
              {(profile?.role==="teacher"?allowedSections:sections).map(s=><option key={s.id} value={s.id}>{"Grade "+s.grade_level+" · "+s.name}</option>)}
            </select>
          </label>}

          <label>
            <span>Post status</span>
            <select name="status" defaultValue="published">
              <option value="published">Publish now</option>
              <option value="draft">Save as draft</option>
            </select>
          </label>

          <label>
            <span>Expiration <small>optional</small></span>
            <input name="expiresAt" type="datetime-local"/>
          </label>

          {isAdmin&&announcementType==="memorandum"&&<label className={styles.fileField}>
            <span>Memorandum file <small>PDF or image, up to 4 MB</small></span>
            <input name="file" type="file" accept=".pdf,image/jpeg,image/png,image/webp"/>
          </label>}
        </div>

        <div className={styles.formActions}>
          <button type="submit" disabled={working==="create"}>
            <Send size={16}/>{working==="create"?"Posting…":announcementType==="memorandum"?"Post memorandum":"Post announcement"}
          </button>
        </div>
      </form>
    </section>}

    <section className={styles.feed}>
      <div className={styles.feedHead}>
        <div><h2>Latest posts</h2><p>{profile?.role==="administrator"?"Published posts and your drafts.":"Announcements relevant to your account."}</p></div>
        <span>{announcements.length} post{announcements.length===1?"":"s"}</span>
      </div>

      {loading?<div className={styles.empty}>Loading announcements…</div>:
      announcements.length===0?<div className={styles.empty}><Megaphone size={30}/><strong>No announcements yet</strong><span>New school communications will appear here.</span></div>:
      <div className={styles.list}>
        {announcements.map(item=>{
          const own=item.created_by===profile?.id;
          const canManage=isAdmin||own;
          return <article className={styles.card} key={item.id}>
            <div className={styles.cardTop}>
              <div className={styles.badges}>
                <span className={item.announcement_type==="memorandum"?styles.memoBadge:styles.announcementBadge}>
                  {item.announcement_type==="memorandum"?"Memorandum":"Announcement"}
                </span>
                <span className={item.status==="published"?styles.published:item.status==="draft"?styles.draft:styles.archived}>
                  {item.status[0].toUpperCase()+item.status.slice(1)}
                </span>
              </div>
              <span className={styles.audience}>{audienceLabel(item)}</span>
            </div>

            <h3>{item.title}</h3>

            {item.announcement_type==="memorandum"&&(item.memo_number||item.memo_date)&&<div className={styles.memoMeta}>
              {item.memo_number&&<strong>{item.memo_number}</strong>}
              {item.memo_date&&<span>{dateLabel(item.memo_date)}</span>}
            </div>}

            {item.body&&<p className={styles.body}>{item.body}</p>}

            {item.attachment_name&&<a className={styles.attachment} href={"/api/announcements/file?id="+encodeURIComponent(item.id)} target="_blank" rel="noreferrer">
              {item.attachment_mime_type==="application/pdf"?<FileText size={21}/>:<FileImage size={21}/>}
              <div><strong>{item.attachment_name}</strong><span>{item.attachment_mime_type==="application/pdf"?"PDF document":"Image"}{item.attachment_size?" · "+fileSize(item.attachment_size):""}</span></div>
              <span>Open</span>
            </a>}

            <footer>
              <div><span>Posted by</span><strong>{item.posted_by_name}</strong></div>
              <div><span>{item.status==="published"?"Published":"Created"}</span><strong>{dateLabel(item.published_at||item.created_at)}</strong></div>
              {item.expires_at&&<div><span>Expires</span><strong>{dateLabel(item.expires_at)}</strong></div>}
            </footer>

            {canManage&&item.status!=="archived"&&<div className={styles.cardActions}>
              {item.status==="published"
                ?<button onClick={()=>void updateStatus(item.id,"draft")} disabled={working===item.id}>Return to draft</button>
                :<button onClick={()=>void updateStatus(item.id,"publish")} disabled={working===item.id}><Send size={14}/>Publish</button>}
              <button className={styles.archiveButton} onClick={()=>void updateStatus(item.id,"archive")} disabled={working===item.id}><Archive size={14}/>Archive</button>
            </div>}
          </article>;
        })}
      </div>}
    </section>
  </div></main>;
}
