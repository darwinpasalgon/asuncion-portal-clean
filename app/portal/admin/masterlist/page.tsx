"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Download, FileSpreadsheet, RefreshCw, ShieldCheck, Upload, Users } from "lucide-react";
import styles from "./masterlist.module.css";

type PersonType = "student" | "teacher";
type PreviewRow = {
  rowNumber:number; fullName:string; lrn:string; gradeLevel:number|null; section:string;
  email:string; position:string; recoveryPhone:string; valid:boolean; error:string;
};
type CreatedAccount = {
  row_number:number|null; full_name:string; identifier:string; grade_level:number|null;
  section:string|null; position:string|null; temporary_password:string;
};
type ImportError = { row_number?:number|null; name?:string; identifier?:string; error:string };
type Batch = {
  id:string; person_type:PersonType; file_name:string; total_rows:number;
  imported_rows:number; skipped_rows:number; created_at:string;
};

function esc(value:unknown){ return '"' + String(value ?? "").replace(/"/g,'""') + '"'; }
function downloadCsv(name:string, headers:string[], rows:unknown[][]){
  const csv=[headers.map(esc).join(","),...rows.map(row=>row.map(esc).join(","))].join("\r\n");
  const url=URL.createObjectURL(new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8"}));
  const a=document.createElement("a"); a.href=url; a.download=name; a.click(); URL.revokeObjectURL(url);
}
function dateLabel(value:string){ return new Date(value).toLocaleString(); }

export default function BulkAccountImportPage(){
  const [type,setType]=useState<PersonType>("student");
  const [file,setFile]=useState<File|null>(null);
  const [preview,setPreview]=useState<PreviewRow[]>([]);
  const [summary,setSummary]=useState<{total:number;valid:number;invalid:number}|null>(null);
  const [accounts,setAccounts]=useState<CreatedAccount[]>([]);
  const [importErrors,setImportErrors]=useState<ImportError[]>([]);
  const [batches,setBatches]=useState<Batch[]>([]);
  const [year,setYear]=useState<{id:string;name:string}|null>(null);
  const [working,setWorking]=useState<""|"preview"|"import">("");
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [success,setSuccess]=useState("");

  async function load(){
    setLoading(true);
    try{
      const r=await fetch("/api/admin/masterlist",{cache:"no-store"});
      const x=await r.json().catch(()=>({}));
      if(!r.ok){setError(x.error??"Unable to load the import workspace.");return;}
      setYear(x.activeYear??null); setBatches(x.batches??[]);
    }catch{setError("Unable to reach the import service.");}
    finally{setLoading(false);}
  }
  useEffect(()=>{void load();},[]);
  const validRows=useMemo(()=>preview.filter(row=>row.valid),[preview]);

  function reset(next:PersonType){
    setType(next); setFile(null); setPreview([]); setSummary(null);
    setAccounts([]); setImportErrors([]); setError(""); setSuccess("");
  }
  function choose(e:ChangeEvent<HTMLInputElement>){
    setFile(e.target.files?.[0]??null); setPreview([]); setSummary(null);
    setAccounts([]); setImportErrors([]); setError(""); setSuccess("");
  }
  function template(){
    if(type==="student"){
      downloadCsv("ANHS_Student_Account_Import_Template.csv",
        ["LRN","Full Name","Grade Level","Section","Mobile"],
        [["123456789012","Juan Dela Cruz",8,"Narra","09171234567"]]);
    }else{
      downloadCsv("ANHS_Teacher_Account_Import_Template.csv",
        ["Full Name","Email","Position","Mobile"],
        [["Juan Teacher","juan.teacher@deped.gov.ph","Teacher III","09171234567"]]);
    }
  }
  async function process(action:"preview"|"import"){
    if(!file){setError("Choose a CSV masterlist first.");return;}
    setWorking(action); setError(""); setSuccess("");
    if(action==="import"){setAccounts([]);setImportErrors([]);}
    try{
      const body=new FormData(); body.set("action",action); body.set("personType",type); body.set("file",file);
      const r=await fetch("/api/admin/masterlist",{method:"POST",body});
      const x=await r.json().catch(()=>({}));
      if(!r.ok){setError(x.error??"Unable to process the import.");return;}
      if(action==="preview"){
        setPreview(x.rows??[]); setSummary(x.summary??null);
        setSuccess("Validation complete. Review the rows before creating accounts.");
      }else{
        setAccounts(x.accounts??[]); setImportErrors(x.errors??[]);
        setSuccess(`${x.imported??0} account(s) created. ${x.skipped??0} row(s) skipped.`);
        await load();
      }
    }catch{setError("Unable to reach the import service.");}
    finally{setWorking("");}
  }
  function credentials(){
    if(type==="student"){
      downloadCsv("ANHS_Student_Temporary_Credentials.csv",
        ["LRN","Full Name","Grade Level","Section","Temporary Password"],
        accounts.map(a=>[a.identifier,a.full_name,a.grade_level??"",a.section??"",a.temporary_password]));
    }else{
      downloadCsv("ANHS_Teacher_Temporary_Credentials.csv",
        ["Full Name","Email","Position","Temporary Password"],
        accounts.map(a=>[a.full_name,a.identifier,a.position??"Teacher",a.temporary_password]));
    }
  }

  return <main className={styles.page}><div className={styles.shell}>
    <nav className={styles.topbar}>
      <a href="/portal"><ArrowLeft size={16}/> Back to portal</a>
      <div><a href="/portal/admin/users">Users & accounts</a><a href="/portal/admin/accounts">Pending approvals</a></div>
    </nav>

    <header className={styles.header}>
      <div><span>ADMINISTRATION</span><h1>Bulk account import</h1>
        <p>Create school-managed Student and Teacher accounts from an official CSV masterlist. New users receive a temporary password and must change it on first sign-in.</p>
      </div>
      <div className={styles.year}><small>ACTIVE SCHOOL YEAR</small><strong>{year?.name??"Not configured"}</strong></div>
    </header>

    {error&&<div className={styles.error}>{error}</div>}
    {success&&<div className={styles.success}>{success}</div>}

    <section className={styles.panel}>
      <div className={styles.panelHead}><div><h2>Prepare and validate the masterlist</h2>
        <p>Edit the template in Excel, then save as CSV UTF-8 (Comma delimited).</p></div><FileSpreadsheet size={24}/></div>

      <div className={styles.tabs}>
        <button className={type==="student"?styles.active:""} onClick={()=>reset("student")}>Students</button>
        <button className={type==="teacher"?styles.active:""} onClick={()=>reset("teacher")}>Teachers</button>
      </div>

      <div className={styles.importGrid}>
        <button className={styles.secondary} onClick={template}><Download size={16}/> Download template</button>
        <label className={styles.filePicker}><Upload size={17}/><strong>{file?.name??"Choose CSV file"}</strong>
          <span>CSV UTF-8 · maximum 200 accounts per file</span><input type="file" accept=".csv,text/csv" onChange={choose}/></label>
        <button className={styles.secondary} disabled={!file||Boolean(working)} onClick={()=>void process("preview")}>
          <RefreshCw size={16}/> {working==="preview"?"Checking…":"Validate & preview"}
        </button>
      </div>

      {summary&&<div className={styles.summary}><span>Total <strong>{summary.total}</strong></span>
        <span>Ready <strong>{summary.valid}</strong></span><span>Needs correction <strong>{summary.invalid}</strong></span></div>}

      {preview.length>0&&<>
        <div className={styles.tableWrap}><table><thead><tr>
          <th>Row</th><th>Name</th><th>{type==="student"?"LRN":"Email"}</th>
          <th>{type==="student"?"Class":"Position"}</th><th>Mobile</th><th>Validation</th>
        </tr></thead><tbody>
          {preview.map(row=><tr key={row.rowNumber} className={!row.valid?styles.bad:""}>
            <td>{row.rowNumber}</td><td><strong>{row.fullName||"—"}</strong></td>
            <td>{type==="student"?row.lrn:row.email}</td>
            <td>{type==="student"?(row.gradeLevel?`Grade ${row.gradeLevel} · ${row.section}`:"—"):(row.position||"Teacher")}</td>
            <td>{row.recoveryPhone||"Optional"}</td>
            <td>{row.valid?<span className={styles.ready}>Ready</span>:<span className={styles.invalid}>{row.error}</span>}</td>
          </tr>)}
        </tbody></table></div>
        <div className={styles.createBar}><p><ShieldCheck size={16}/> Rows with errors are skipped. Account creation is immediate and first sign-in requires a password change.</p>
          <button className={styles.primary} disabled={!validRows.length||Boolean(working)} onClick={()=>void process("import")}>
            <Users size={16}/> {working==="import"?"Creating…":`Create ${validRows.length} account(s)`}
          </button>
        </div>
      </>}
    </section>

    {accounts.length>0&&<section className={styles.credentials}>
      <div className={styles.credentialsHead}><div><h2>Temporary credentials</h2>
        <p>Download these now. Plaintext temporary passwords are not stored and cannot be reopened later.</p></div>
        <button onClick={credentials}><Download size={16}/> Download credentials CSV</button></div>
      <div className={styles.grid}>{accounts.map(a=><article key={String(a.row_number)+a.identifier}>
        <strong>{a.full_name}</strong><span>{a.identifier}</span><code>{a.temporary_password}</code>
      </article>)}</div>
    </section>}

    {importErrors.length>0&&<section className={styles.panel}>
      <div className={styles.panelHead}><div><h2>Skipped rows</h2><p>Correct these records and import them again.</p></div></div>
      <div className={styles.tableWrap}><table><thead><tr><th>Row</th><th>Name / identifier</th><th>Reason</th></tr></thead>
        <tbody>{importErrors.map((item,i)=><tr key={String(item.row_number)+i}><td>{item.row_number??"—"}</td>
          <td>{item.name||item.identifier||"—"}</td><td><span className={styles.invalid}>{item.error}</span></td></tr>)}</tbody></table></div>
    </section>}

    <section className={styles.panel}>
      <div className={styles.panelHead}><div><h2>Recent imports</h2><p>History stores counts only, never temporary passwords.</p></div></div>
      {loading?<div className={styles.empty}>Loading import history…</div>:batches.length===0?<div className={styles.empty}>No bulk account imports yet.</div>:
        batches.map(batch=><div className={styles.batch} key={batch.id}><div><strong>{batch.file_name}</strong>
          <span>{batch.person_type==="student"?"Students":"Teachers"} · {dateLabel(batch.created_at)}</span></div>
          <span>{batch.imported_rows} created · {batch.skipped_rows} skipped</span></div>)}
    </section>
  </div></main>;
}
