"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Archive,
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ExternalLink,
  File,
  FileImage,
  FileSpreadsheet,
  FileText,
  Link2,
  Send,
} from "lucide-react";
import styles from "./resources.module.css";

type Role="student"|"teacher"|"administrator";
type Profile={id:string;full_name:string;role:Role};
type Year={id:string;name:string};
type Assignment={id:string;teacher_id:string;grade_level:number;section_id:string;subject_id:string};
type Section={id:string;grade_level:number;name:string};
type Subject={id:string;grade_level:number;name:string;code:string|null};
type Resource={
  id:string;
  school_year_id:string;
  resource_scope:"school"|"class";
  teacher_assignment_id:string|null;
  term_no:number|null;
  category:string;
  title:string;
  description:string|null;
  external_url:string|null;
  status:"draft"|"published"|"archived";
  published_at:string|null;
  created_by:string;
  posted_by_name:string;
  attachment_name:string|null;
  attachment_mime_type:string|null;
  attachment_size:number|null;
  created_at:string;
};

const CATEGORY_LABELS:Record<string,string>={
  lesson_material:"Lesson Material",
  activity_sheet:"Activity Sheet",
  reviewer:"Reviewer",
  reference:"Reference",
  module:"Module",
  video_link:"Video / Link",
  other:"Other",
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

function fileIcon(mime:string|null){
  if(!mime)return <File size={21}/>;
  if(mime.startsWith("image/"))return <FileImage size={21}/>;
  if(mime.includes("spreadsheet")||mime.includes("excel"))return <FileSpreadsheet size={21}/>;
  return <FileText size={21}/>;
}

export default function ResourcesPage(){
  const [profile,setProfile]=useState<Profile|null>(null);
  const [activeYear,setActiveYear]=useState<Year|null>(null);
  const [resources,setResources]=useState<Resource[]>([]);
  const [assignments,setAssignments]=useState<Assignment[]>([]);
  const [sections,setSections]=useState<Section[]>([]);
  const [subjects,setSubjects]=useState<Subject[]>([]);
  const [scope,setScope]=useState<"school"|"class">("class");
  const [termFilter,setTermFilter]=useState("all");
  const [categoryFilter,setCategoryFilter]=useState("all");
  const [subjectFilter,setSubjectFilter]=useState("all");
  const [loading,setLoading]=useState(true);
  const [working,setWorking]=useState("");
  const [error,setError]=useState("");
  const [success,setSuccess]=useState("");

  async function load(){
    setLoading(true);setError("");
    try{
      const r=await fetch("/api/resources",{cache:"no-store"});
      const x=await r.json().catch(()=>({}));
      if(!r.ok){setError(x.error??"Unable to load learning resources.");return;}
      setProfile(x.profile??null);setActiveYear(x.activeYear??null);
      setResources(x.resources??[]);setAssignments(x.assignments??[]);
      setSections(x.sections??[]);setSubjects(x.subjects??[]);
      if(x.profile?.role==="administrator")setScope("school");
      else setScope("class");
    }catch{setError("Unable to reach the learning resources service.");}
    finally{setLoading(false);}
  }

  useEffect(()=>{void load();},[]);

  const isAdmin=profile?.role==="administrator";
  const canPost=profile?.role==="administrator"||profile?.role==="teacher";
  const sectionMap=useMemo(()=>new Map(sections.map(s=>[s.id,s])),[sections]);
  const subjectMap=useMemo(()=>new Map(subjects.map(s=>[s.id,s])),[subjects]);
  const assignmentMap=useMemo(()=>new Map(assignments.map(a=>[a.id,a])),[assignments]);

  function assignmentLabel(a:Assignment){
    const s=sectionMap.get(a.section_id);
    const subject=subjectMap.get(a.subject_id);
    return "Grade "+a.grade_level+" · "+(s?.name??"Section")+" · "+(subject?.name??"Subject")+(subject?.code?" ("+subject.code+")":"");
  }

  const subjectOptions=useMemo(()=>{
    const ids=new Set<string>();
    for(const resource of resources){
      if(!resource.teacher_assignment_id)continue;
      const a=assignmentMap.get(resource.teacher_assignment_id);
      if(a)ids.add(a.subject_id);
    }
    return subjects.filter(s=>ids.has(s.id));
  },[resources,assignmentMap,subjects]);

  const filtered=resources.filter(resource=>{
    if(termFilter!=="all"){
      const value=resource.term_no===null?"none":String(resource.term_no);
      if(value!==termFilter)return false;
    }
    if(categoryFilter!=="all"&&resource.category!==categoryFilter)return false;
    if(subjectFilter!=="all"){
      if(!resource.teacher_assignment_id)return false;
      const a=assignmentMap.get(resource.teacher_assignment_id);
      if(!a||a.subject_id!==subjectFilter)return false;
    }
    return true;
  });

  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    const form=event.currentTarget;
    const data=new FormData(form);
    data.set("resourceScope",profile?.role==="teacher"?"class":scope);

    setWorking("create");setError("");setSuccess("");
    try{
      const r=await fetch("/api/resources",{method:"POST",body:data});
      const x=await r.json().catch(()=>({}));
      if(!r.ok){setError(x.error??"Unable to create the learning resource.");return;}
      setSuccess("Learning resource created successfully.");
      form.reset();
      if(isAdmin)setScope("school");
      await load();
    }catch{setError("Unable to reach the learning resources service.");}
    finally{setWorking("");}
  }

  async function updateStatus(id:string,action:"publish"|"draft"|"archive"){
    setWorking(id);setError("");setSuccess("");
    try{
      const r=await fetch("/api/resources",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({id,action}),
      });
      const x=await r.json().catch(()=>({}));
      if(!r.ok){setError(x.error??"Unable to update the resource.");return;}
      setSuccess(action==="publish"?"Resource published.":action==="draft"?"Resource returned to draft.":"Resource archived.");
      await load();
    }catch{setError("Unable to reach the learning resources service.");}
    finally{setWorking("");}
  }

  function resourceClass(resource:Resource){
    if(resource.resource_scope==="school")return "School-wide";
    if(!resource.teacher_assignment_id)return "Class";
    const a=assignmentMap.get(resource.teacher_assignment_id);
    return a?assignmentLabel(a):"Assigned class";
  }

  return <main className={styles.page}><div className={styles.shell}>
    <nav className={styles.topActions}>
      <a href="/portal" className={styles.topLink}><ArrowLeft size={16}/>Back to portal</a>
    </nav>

    <header className={styles.header}>
      <div>
        <span className={styles.eyebrow}>ACADEMIC MATERIALS</span>
        <h1>Learning resources</h1>
        <p>Class materials, activity sheets, modules, reviewers, references, and useful links for the active school year.</p>
      </div>
      {activeYear&&<div className={styles.yearCard}><CheckCircle2 size={18}/><div><span>SCHOOL YEAR</span><strong>{activeYear.name}</strong></div></div>}
    </header>

    {error&&<div className={styles.error}>{error}</div>}
    {success&&<div className={styles.success}>{success}</div>}

    {canPost&&<section className={styles.composer}>
      <div className={styles.composerHead}>
        <div>
          <span>{isAdmin?"ADMINISTRATOR":"TEACHER"}</span>
          <h2>Add a learning resource</h2>
          <p>{isAdmin?"Post school-wide material or attach a resource to a specific class.":"Post material only to classes assigned to your Teacher account."}</p>
        </div>
        <BookOpen size={28}/>
      </div>

      <form className={styles.form} onSubmit={submit}>
        {isAdmin&&<div className={styles.scopeTabs}>
          <button type="button" className={scope==="school"?styles.scopeActive:styles.scopeButton} onClick={()=>setScope("school")}>School-wide</button>
          <button type="button" className={scope==="class"?styles.scopeActive:styles.scopeButton} onClick={()=>setScope("class")}>Specific class</button>
        </div>}

        <div className={styles.formGrid}>
          {(scope==="class"||profile?.role==="teacher")&&<label className={styles.wide}>
            <span>Assigned class</span>
            <select name="assignmentId" required defaultValue="">
              <option value="" disabled>Select class</option>
              {assignments.map(a=><option key={a.id} value={a.id}>{assignmentLabel(a)}</option>)}
            </select>
          </label>}

          <label>
            <span>Category</span>
            <select name="category" required defaultValue="">
              <option value="" disabled>Select category</option>
              {Object.entries(CATEGORY_LABELS).map(([value,label])=><option key={value} value={value}>{label}</option>)}
            </select>
          </label>

          <label>
            <span>Term <small>optional</small></span>
            <select name="termNo" defaultValue="">
              <option value="">All terms / not specified</option>
              <option value="1">Term 1</option>
              <option value="2">Term 2</option>
              <option value="3">Term 3</option>
            </select>
          </label>

          <label className={styles.wide}>
            <span>Title</span>
            <input name="title" required minLength={2} maxLength={180} placeholder="e.g. Network Devices Reviewer"/>
          </label>

          <label className={styles.wide}>
            <span>Description <small>optional</small></span>
            <textarea name="description" rows={4} maxLength={10000} placeholder="Brief instructions or description for students..."/>
          </label>

          <label>
            <span>External link <small>optional</small></span>
            <div className={styles.iconInput}><Link2 size={16}/><input name="externalUrl" type="url" placeholder="https://..."/></div>
          </label>

          <label>
            <span>File <small>optional · max 10 MB</small></span>
            <input name="file" type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,image/jpeg,image/png,image/webp"/>
          </label>

          <label>
            <span>Status</span>
            <select name="status" defaultValue="published">
              <option value="published">Publish now</option>
              <option value="draft">Save as draft</option>
            </select>
          </label>
        </div>

        <p className={styles.formHint}>Add at least one file or external link. You may include both.</p>

        <div className={styles.formActions}>
          <button type="submit" disabled={working==="create"}><Send size={16}/>{working==="create"?"Posting…":"Post resource"}</button>
        </div>
      </form>
    </section>}

    <section className={styles.library}>
      <div className={styles.libraryHead}>
        <div><h2>Resource library</h2><p>{profile?.role==="student"?"Materials available to your enrolled classes.":"Published resources and any drafts available to your account."}</p></div>
        <span>{filtered.length} resource{filtered.length===1?"":"s"}</span>
      </div>

      <div className={styles.filters}>
        <select value={termFilter} onChange={e=>setTermFilter(e.target.value)}>
          <option value="all">All terms</option>
          <option value="1">Term 1</option>
          <option value="2">Term 2</option>
          <option value="3">Term 3</option>
          <option value="none">No term specified</option>
        </select>
        <select value={categoryFilter} onChange={e=>setCategoryFilter(e.target.value)}>
          <option value="all">All categories</option>
          {Object.entries(CATEGORY_LABELS).map(([value,label])=><option key={value} value={value}>{label}</option>)}
        </select>
        <select value={subjectFilter} onChange={e=>setSubjectFilter(e.target.value)}>
          <option value="all">All subjects</option>
          {subjectOptions.map(s=><option key={s.id} value={s.id}>{s.name}{s.code?" ("+s.code+")":""}</option>)}
        </select>
      </div>

      {loading?<div className={styles.empty}>Loading resources…</div>:
      filtered.length===0?<div className={styles.empty}><BookOpen size={30}/><strong>No resources found</strong><span>Published materials will appear here.</span></div>:
      <div className={styles.grid}>
        {filtered.map(resource=>{
          const canManage=isAdmin||resource.created_by===profile?.id;
          return <article className={styles.card} key={resource.id}>
            <div className={styles.cardTop}>
              <div className={styles.badges}>
                <span className={styles.categoryBadge}>{CATEGORY_LABELS[resource.category]??"Resource"}</span>
                {resource.term_no&&<span className={styles.termBadge}>Term {resource.term_no}</span>}
                <span className={resource.status==="published"?styles.published:resource.status==="draft"?styles.draft:styles.archived}>{resource.status[0].toUpperCase()+resource.status.slice(1)}</span>
              </div>
            </div>

            <span className={styles.classLabel}>{resourceClass(resource)}</span>
            <h3>{resource.title}</h3>
            {resource.description&&<p>{resource.description}</p>}

            <div className={styles.resourceActions}>
              {resource.attachment_name&&<a href={"/api/resources/file?id="+encodeURIComponent(resource.id)} target="_blank" rel="noreferrer" className={styles.fileLink}>
                {fileIcon(resource.attachment_mime_type)}
                <div><strong>{resource.attachment_name}</strong><span>{fileSize(resource.attachment_size)}</span></div>
                <span>Open</span>
              </a>}

              {resource.external_url&&<a href={resource.external_url} target="_blank" rel="noreferrer" className={styles.externalLink}><ExternalLink size={17}/>Open external link</a>}
            </div>

            <footer>
              <div><span>Posted by</span><strong>{resource.posted_by_name}</strong></div>
              <div><span>{resource.status==="published"?"Published":"Created"}</span><strong>{dateLabel(resource.published_at||resource.created_at)}</strong></div>
            </footer>

            {canManage&&resource.status!=="archived"&&<div className={styles.manage}>
              {resource.status==="published"
                ?<button onClick={()=>void updateStatus(resource.id,"draft")} disabled={working===resource.id}>Return to draft</button>
                :<button onClick={()=>void updateStatus(resource.id,"publish")} disabled={working===resource.id}><Send size={14}/>Publish</button>}
              <button className={styles.archiveButton} onClick={()=>void updateStatus(resource.id,"archive")} disabled={working===resource.id}><Archive size={14}/>Archive</button>
            </div>}
          </article>;
        })}
      </div>}
    </section>
  </div></main>;
}
