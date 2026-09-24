"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  KeyRound,
  RefreshCw,
  Upload,
  UserRoundCheck,
  Users,
} from "lucide-react";
import styles from "./masterlist.module.css";

type PersonType="student"|"teacher";
type PreviewRow={
  rowNumber:number;
  fullName:string;
  lrn:string;
  gradeLevel:number|null;
  section:string;
  email:string;
  position:string;
  valid:boolean;
  error:string;
};
type Activation={
  fullName:string;
  identifier:string;
  gradeLevel?:number|null;
  section?:string;
  position?:string;
  code:string;
};
type RosterRow={
  id:string;
  person_type:PersonType;
  full_name:string;
  lrn:string|null;
  email:string|null;
  position:string|null;
  grade_level:number|null;
  section_id:string|null;
  activation_code_last4:string;
  status:"unclaimed"|"activated"|"disabled";
  claimed_at:string|null;
  created_at:string;
};
type Section={id:string;grade_level:number;name:string};
type Batch={
  id:string;
  person_type:PersonType;
  file_name:string;
  total_rows:number;
  imported_rows:number;
  skipped_rows:number;
  created_at:string;
};

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
  a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();
  URL.revokeObjectURL(url);
}

function dateLabel(value:string){
  return new Date(value).toLocaleString([],{
    year:"numeric",month:"short",day:"numeric",hour:"numeric",minute:"2-digit"
  });
}

export default function MasterlistPage(){
  const [personType,setPersonType]=useState<PersonType>("student");
  const [file,setFile]=useState<File|null>(null);
  const [preview,setPreview]=useState<PreviewRow[]>([]);
  const [summary,setSummary]=useState<{total:number;valid:number;invalid:number}|null>(null);
  const [activations,setActivations]=useState<Activation[]>([]);
  const [roster,setRoster]=useState<RosterRow[]>([]);
  const [sections,setSections]=useState<Section[]>([]);
  const [batches,setBatches]=useState<Batch[]>([]);
  const [activeYear,setActiveYear]=useState<{id:string;name:string}|null>(null);
  const [loading,setLoading]=useState(true);
  const [working,setWorking]=useState("");
  const [error,setError]=useState("");
  const [success,setSuccess]=useState("");

  async function load(){
    setLoading(true);setError("");
    try{
      const r=await fetch("/api/admin/masterlist",{cache:"no-store"});
      const x=await r.json().catch(()=>({}));
      if(!r.ok){setError(x.error??"Unable to load the account masterlist.");return;}
      setActiveYear(x.activeYear??null);
      setRoster(x.roster??[]);
      setSections(x.sections??[]);
      setBatches(x.batches??[]);
    }catch{setError("Unable to reach the masterlist service.");}
    finally{setLoading(false);}
  }

  useEffect(()=>{void load();},[]);

  const sectionMap=useMemo(()=>new Map(sections.map(s=>[s.id,s])),[sections]);
  const visibleRoster=roster.filter(row=>row.person_type===personType);
  const validRows=preview.filter(row=>row.valid);

  function selectFile(event:ChangeEvent<HTMLInputElement>){
    const next=event.target.files?.[0]??null;
    setFile(next);setPreview([]);setSummary(null);setActivations([]);setError("");setSuccess("");
  }

  function template(){
    if(personType==="student"){
      downloadCsv(
        "ANHS_Student_Masterlist_Template.csv",
        ["LRN","Full Name","Grade Level","Section"],
        [["123456789012","Juan Dela Cruz",8,"Narra"]]
      );
    }else{
      downloadCsv(
        "ANHS_Teacher_Masterlist_Template.csv",
        ["Full Name","Email","Position"],
        [["Juan Teacher","juan.teacher@deped.gov.ph","Teacher"]]
      );
    }
  }

  async function sendFile(action:"preview"|"import"){
    if(!file){setError("Choose a CSV masterlist file first.");return;}
    setWorking(action);setError("");setSuccess("");
    const body=new FormData();
    body.set("action",action);body.set("personType",personType);body.set("file",file);

    try{
      const r=await fetch("/api/admin/masterlist",{method:"POST",body});
      const x=await r.json().catch(()=>({}));
      if(!r.ok){setError(x.error??"Unable to process the masterlist.");return;}

      if(action==="preview"){
        setPreview(x.rows??[]);
        setSummary(x.summary??null);
        setSuccess("Validation complete. Review the rows before importing.");
      }else{
        setActivations(x.activations??[]);
        setSuccess(
          (x.summary?.imported??0)+" record"+((x.summary?.imported??0)===1?"":"s")+" imported. Download the activation codes now."
        );
        await load();
      }
    }catch{setError("Unable to reach the masterlist service.");}
    finally{setWorking("");}
  }

  function downloadActivations(){
    if(!activations.length)return;
    if(personType==="student"){
      downloadCsv(
        "ANHS_Student_Activation_Codes.csv",
        ["LRN","Full Name","Grade Level","Section","Activation Code"],
        activations.map(a=>[a.identifier,a.fullName,a.gradeLevel??"",a.section??"",a.code])
      );
    }else{
      downloadCsv(
        "ANHS_Teacher_Activation_Codes.csv",
        ["Full Name","Email","Position","Activation Code"],
        activations.map(a=>[a.fullName,a.identifier,a.position??"Teacher",a.code])
      );
    }
  }

  async function regenerate(row:RosterRow){
    setWorking(row.id);setError("");setSuccess("");
    try{
      const r=await fetch("/api/admin/masterlist",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({action:"regenerate",id:row.id}),
      });
      const x=await r.json().catch(()=>({}));
      if(!r.ok){setError(x.error??"Unable to regenerate the activation code.");return;}
      setActivations(prev=>[
        {
          fullName:x.activation.fullName,
          identifier:x.activation.identifier,
          gradeLevel:row.grade_level,
          section:row.section_id?sectionMap.get(row.section_id)?.name:"",
          position:row.position??"Teacher",
          code:x.activation.code,
        },
        ...prev,
      ]);
      setSuccess("A new one-time activation code was generated. Download or copy it now.");
      await load();
    }catch{setError("Unable to reach the masterlist service.");}
    finally{setWorking("");}
  }

  return <main className={styles.page}><div className={styles.shell}>
    <nav className={styles.top}><a href="/portal"><ArrowLeft size={16}/>Back to portal</a></nav>

    <header className={styles.header}>
      <div><span>ACCOUNT MANAGEMENT</span><h1>Masterlist & account activation</h1>
        <p>Import the official school roster, validate records, and issue one-time activation codes.</p>
      </div>
      {activeYear&&<div className={styles.year}><CheckCircle2 size={18}/><div><small>ACTIVE SCHOOL YEAR</small><strong>{activeYear.name}</strong></div></div>}
    </header>

    {error&&<div className={styles.error}>{error}</div>}
    {success&&<div className={styles.success}>{success}</div>}

    <section className={styles.panel}>
      <div className={styles.panelHead}>
        <div><h2>Import official masterlist</h2><p>Use the CSV template in Excel, then save it as CSV UTF-8 before uploading.</p></div>
        <FileSpreadsheet size={25}/>
      </div>

      <div className={styles.tabs}>
        <button className={personType==="student"?styles.activeTab:styles.tab} onClick={()=>{setPersonType("student");setPreview([]);setSummary(null);setActivations([]);}}>Students</button>
        <button className={personType==="teacher"?styles.activeTab:styles.tab} onClick={()=>{setPersonType("teacher");setPreview([]);setSummary(null);setActivations([]);}}>Teachers</button>
      </div>

      <div className={styles.importBox}>
        <button className={styles.secondary} onClick={template}><Download size={16}/>Download {personType==="student"?"Student":"Teacher"} CSV template</button>
        <label className={styles.filePicker}><Upload size={18}/><div><strong>{file?.name??"Choose CSV file"}</strong><span>CSV UTF-8 · up to 2 MB · maximum 2,000 rows</span></div><input type="file" accept=".csv,text/csv" onChange={selectFile}/></label>
        <div className={styles.importActions}>
          <button disabled={!file||Boolean(working)} onClick={()=>void sendFile("preview")}><RefreshCw size={16}/>{working==="preview"?"Checking…":"Validate & preview"}</button>
          <button className={styles.primary} disabled={!file||!validRows.length||Boolean(working)} onClick={()=>void sendFile("import")}><UserRoundCheck size={16}/>{working==="import"?"Importing…":"Import valid records"}</button>
        </div>
      </div>

      {summary&&<div className={styles.summary}>
        <span>Total <strong>{summary.total}</strong></span>
        <span>Valid <strong>{summary.valid}</strong></span>
        <span>Needs correction <strong>{summary.invalid}</strong></span>
      </div>}

      {preview.length>0&&<div className={styles.tableWrap}><table>
        <thead><tr><th>Row</th><th>Name</th><th>{personType==="student"?"LRN":"Email"}</th>{personType==="student"&&<><th>Grade</th><th>Section</th></>}<th>Status</th></tr></thead>
        <tbody>{preview.map(row=><tr key={row.rowNumber} className={!row.valid?styles.invalidRow:""}>
          <td>{row.rowNumber}</td><td><strong>{row.fullName||"—"}</strong></td><td>{personType==="student"?row.lrn:row.email}</td>
          {personType==="student"&&<><td>{row.gradeLevel??"—"}</td><td>{row.section||"—"}</td></>}
          <td>{row.valid?<span className={styles.valid}>Ready</span>:<span className={styles.invalid}>{row.error}</span>}</td>
        </tr>)}</tbody>
      </table></div>}
    </section>

    {activations.length>0&&<section className={styles.codes}>
      <div><KeyRound size={23}/><div><h2>Activation codes</h2><p>These plaintext codes are shown only now. The database stores only a secure hash.</p></div></div>
      <button onClick={downloadActivations}><Download size={16}/>Download activation codes CSV</button>
      <div className={styles.codeGrid}>{activations.map((item,index)=><article key={item.identifier+"-"+index}>
        <strong>{item.fullName}</strong><span>{item.identifier}</span><code>{item.code}</code>
      </article>)}</div>
    </section>}

    <section className={styles.panel}>
      <div className={styles.panelHead}><div><h2>Current activation masterlist</h2><p>Activated records cannot be reused. Unclaimed codes may be regenerated.</p></div><Users size={24}/></div>
      {loading?<div className={styles.empty}>Loading masterlist…</div>:
      visibleRoster.length===0?<div className={styles.empty}>No {personType} activation records have been imported yet.</div>:
      <div className={styles.tableWrap}><table>
        <thead><tr><th>Name</th><th>{personType==="student"?"LRN":"Email"}</th><th>{personType==="student"?"Class":"Position"}</th><th>Status</th><th>Code</th><th>Action</th></tr></thead>
        <tbody>{visibleRoster.map(row=>{
          const s=row.section_id?sectionMap.get(row.section_id):null;
          return <tr key={row.id}>
            <td><strong>{row.full_name}</strong></td>
            <td>{personType==="student"?row.lrn:row.email}</td>
            <td>{personType==="student"?(s?("Grade "+row.grade_level+" · "+s.name):"—"):(row.position||"Teacher")}</td>
            <td><span className={row.status==="activated"?styles.activated:row.status==="unclaimed"?styles.unclaimed:styles.disabled}>{row.status}</span></td>
            <td>{row.status==="unclaimed"?"•••• "+row.activation_code_last4:"—"}</td>
            <td>{row.status==="unclaimed"?<button className={styles.smallButton} disabled={working===row.id} onClick={()=>void regenerate(row)}>Regenerate</button>:"—"}</td>
          </tr>;
        })}</tbody>
      </table></div>}
    </section>

    {batches.length>0&&<section className={styles.panel}>
      <div className={styles.panelHead}><div><h2>Recent imports</h2><p>Audit trail for uploaded account masterlists.</p></div></div>
      <div className={styles.batchList}>{batches.slice(0,10).map(batch=><div key={batch.id}>
        <div><strong>{batch.file_name}</strong><span>{batch.person_type==="student"?"Students":"Teachers"} · {dateLabel(batch.created_at)}</span></div>
        <span>{batch.imported_rows} imported · {batch.skipped_rows} skipped</span>
      </div>)}</div>
    </section>}
  </div></main>;
}
