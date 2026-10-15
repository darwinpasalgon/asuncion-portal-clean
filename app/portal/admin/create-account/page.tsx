"use client";

import {FormEvent,useEffect,useMemo,useState} from "react";
import {ArrowLeft,CheckCircle2,Download,KeyRound,ShieldCheck,UserPlus,X} from "lucide-react";
import {nonTeachingPositions,teachingPositions} from "@/lib/deped-positions";
import styles from "./create-account.module.css";

type Kind="student"|"teacher"|"non_teaching";
type SchoolSection={id:string;name:string;grade_level:number;program_type:string|null};
type Credentials={full_name:string;identifier:string;person_type:Kind;position:string|null;access_role:string|null;temporary_password:string;must_change_password:boolean};
const strands:Record<string,{value:string;label:string}[]>={
  "Academic":[
    {value:"Science, Technology, Engineering, and Mathematics",label:"STEM"},
    {value:"Humanities and Social Sciences",label:"HUMSS"},
    {value:"Accountancy, Business, and Management",label:"ABM"},
  ],
  "Technical-Vocational-Livelihood":[
    {value:"Organic Agriculture Production",label:"Organic Agriculture Production"},
    {value:"Food Processing",label:"Food Processing"},
  ],
};
const roleLabels:Record<string,string>={
  registrar:"Registrar",
  content_administrator:"Content Administrator",
  school_administrator:"School Administrator",
};
const staffPermissions=[
  {id:"reports.view",label:"View Reports"},
  {id:"sf10.manage",label:"Manage SF10"},
  {id:"hr.manage",label:"Personnel / HR Records"},
  {id:"announcements.manage",label:"Announcements & Memos"},
  {id:"resources.manage",label:"School Resources"},
  {id:"attendance.manage",label:"Attendance Administration"},
  {id:"schedules.manage",label:"Class Scheduling"},
  {id:"teaching.manage",label:"Teaching Assignments"},
  {id:"school_setup.manage",label:"School Setup"},
  {id:"users.manage",label:"Manage User Accounts"},
  {id:"accounts.manage",label:"Account Approvals"},
  {id:"bulk_import.manage",label:"Bulk Account Import"},
  {id:"password_resets.manage",label:"Password Resets"},
];

function asCsv(values:string[]) {
  return values.map(value=>`"${String(value).replaceAll('"','""')}"`).join(",");
}
export default function CreateAccountPage(){
  const [kind,setKind]=useState<Kind>("teacher");
  const [sections,setSections]=useState<SchoolSection[]>([]);
  const [loaded,setLoaded]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [created,setCreated]=useState<Credentials|null>(null);

  const [fullName,setFullName]=useState("");
  const [firstName,setFirstName]=useState("");
  const [lastName,setLastName]=useState("");
  const [middleName,setMiddleName]=useState("");
  const [suffix,setSuffix]=useState("");
  const [lrn,setLrn]=useState("");
  const [grade,setGrade]=useState("");
  const [section,setSection]=useState("");
  const [sex,setSex]=useState("");
  const [birthDate,setBirthDate]=useState("");
  const [shsTrack,setShsTrack]=useState("");
  const [shsProgram,setShsProgram]=useState("");
  const [email,setEmail]=useState("");
  const [phone,setPhone]=useState("");
  const [position,setPosition]=useState("");
  const [adminRole,setAdminRole]=useState("");
  const [accessPermissions,setAccessPermissions]=useState<string[]>([]);
  const [downloaded,setDownloaded]=useState(false);

  useEffect(()=>{
    let active=true;
    fetch("/api/admin/manual-account",{cache:"no-store"})
      .then(async response=>{
        const body=await response.json().catch(()=>({}));
        if(!response.ok)throw new Error(body.error??"Unable to load account creation.");
        if(active)setSections(body.sections??[]);
      })
      .catch(e=>{if(active)setError(e instanceof Error?e.message:"Unable to load sections.");})
      .finally(()=>{if(active)setLoaded(true);});
    return()=>{active=false};
  },[]);
  const classOptions=useMemo(()=>sections.filter(s=>String(s.grade_level)===grade),[sections,grade]);
  const firstAndLast=Boolean(firstName.trim()&&lastName.trim());
  const isValid=kind==="student"
    ? firstAndLast && /^\d{12}$/.test(lrn) && Boolean(grade&&section)
      && (grade!=="12" || Boolean(shsTrack)===Boolean(shsProgram))
    : Boolean(fullName.trim()&&position&&(kind==="teacher"||adminRole));
  const selectedSection=sections.find(s=>s.id===section);
  const studentDisplayName=[lastName.trim().toUpperCase()+",",firstName.trim(),middleName.trim(),suffix.trim()]
    .filter(Boolean).join(" ").replace(/\s+/g," ").trim();

  function resetForAnother(){
    setCreated(null);setDownloaded(false);setFullName("");
    setFirstName("");setLastName("");setMiddleName("");setSuffix("");setLrn("");
    setGrade("");setSection("");setSex("");setBirthDate("");
    setShsTrack("");setShsProgram("");setEmail("");setPhone("");
    setPosition("");setAdminRole("");setAccessPermissions([]);setError("");
  }
  function selectKind(next:Kind){
    if(busy)return;
    resetForAnother();setKind(next);
  }
  function download(){
    if(!created)return;
    const body=[
      asCsv(["Name","Account Type","Login","Temporary Password","Designation","Access Role","First Login Action"]),
      asCsv([created.full_name,created.person_type,created.identifier,created.temporary_password,
        created.position??"",created.access_role??"","Change temporary password at first login"]),
    ].join("\r\n");
    const blob=new Blob(["\ufeff",body],{type:"text/csv;charset=utf-8"});
    const url=URL.createObjectURL(blob);
    const link=document.createElement("a");
    link.href=url;link.download=`anhs-${created.person_type}-account-credentials.csv`;
    document.body.appendChild(link);link.click();link.remove();URL.revokeObjectURL(url);
    setDownloaded(true);
  }
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(busy||created||!isValid)return;
    setError("");setBusy(true);
    try{
      const request={
        personType:kind,fullName:kind==="student"?studentDisplayName:fullName.trim(),
        firstName,lastName,middleName,suffix,lrn,gradeLevel:Number(grade),
        section:selectedSection?.name??"",sex,birthDate,shsTrack,shsProgram,
        email:email.trim(),phone:phone.trim(),position,adminRole,accessPermissions,
      };
      const response=await fetch("/api/admin/manual-account",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify(request),cache:"no-store",
      });
      const body=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(body.error??"Unable to create account.");
      if(!body.account?.temporary_password)throw new Error("Account created but credential delivery failed. Contact the Super Administrator.");
      setCreated(body.account as Credentials);
    }catch(e){setError(e instanceof Error?e.message:"Unable to create account.");}
    finally{setBusy(false);}
  }

  return <main className={styles.page}><div className={styles.shell}>
    <nav className={styles.topnav}><a href="/portal/admin/users"><ArrowLeft size={16}/>Users &amp; Accounts</a></nav>
    <header className={styles.header}>
      <div><span>SUPER ADMIN · ACCOUNT MANAGEMENT</span><h1>Create Account</h1>
        <p>Add one learner, teacher, or non-teaching staff member without an Excel/CSV import.
          A temporary password will be issued once and must be changed at first login.</p></div>
      <div className={styles.secure}><ShieldCheck size={20}/>Super Admin Only</div>
    </header>
    {error&&<div role="alert" className={styles.error}>{error}</div>}
    {!created ? <form className={styles.panel} onSubmit={event=>void submit(event)}>
      <div className={styles.panelTop}><UserPlus size={19}/><strong>New Portal Account</strong></div>
      <fieldset className={styles.kindOptions} disabled={busy}>
        <legend>Account Type</legend>
        {([
          ["student","Student / Learner"],
          ["teacher","Teaching Personnel"],
          ["non_teaching","Non-Teaching Personnel"],
        ] as [Kind,string][]).map(([value,label])=>
          <label key={value} className={kind===value?styles.selectedKind:styles.kindOption}>
            <input type="radio" name="kind" checked={kind===value} onChange={()=>selectKind(value)}/>{label}
          </label>
        )}
      </fieldset>
      {kind==="student"?<section className={styles.formSection}>
        <h2>Learner Information</h2>
        <div className={styles.formGrid}>
          <label>LRN (12 Digits) <input value={lrn} maxLength={12} inputMode="numeric" placeholder="Enter learner's LRN" required pattern="[0-9]{12}" onChange={e=>setLrn(e.target.value.replace(/\D/g,""))}/></label>
          <label>Last Name <input value={lastName} required maxLength={100} onChange={e=>setLastName(e.target.value)}/></label>
          <label>First Name <input value={firstName} required maxLength={100} onChange={e=>setFirstName(e.target.value)}/></label>
          <label>Middle Name (Optional) <input value={middleName} maxLength={100} onChange={e=>setMiddleName(e.target.value)}/></label>
          <label>Suffix (Optional) <input value={suffix} maxLength={20} placeholder="JR., III" onChange={e=>setSuffix(e.target.value)}/></label>
          <label>Grade Level <select value={grade} required onChange={e=>{setGrade(e.target.value);setSection("");setShsTrack("");setShsProgram("");}}>
            <option value="">Select Grade</option>{[7,8,9,10,11,12].map(level=><option key={level} value={level}>Grade {level}</option>)}
          </select></label>
          <label>Section <select value={section} required disabled={!grade||!loaded} onChange={e=>setSection(e.target.value)}>
            <option value="">Select Section</option>{classOptions.map(s=><option value={s.id} key={s.id}>{s.name}{s.program_type==="ALS-SHS"?" (ALS-SHS)":""}</option>)}
          </select></label>
          <label>Sex (Optional) <select value={sex} onChange={e=>setSex(e.target.value)}>
            <option value="">Not Specified</option><option value="M">Male</option><option value="F">Female</option>
          </select></label>
          <label>Birth Date (Optional) <input type="date" max={new Date().toISOString().slice(0,10)} value={birthDate} onChange={e=>setBirthDate(e.target.value)}/></label>
          {grade==="12"&&<>
            <label>SHS Track (If Known)<select value={shsTrack} onChange={e=>{setShsTrack(e.target.value);setShsProgram("");}}>
              <option value="">To Be Assigned</option><option value="Academic">Academic</option><option value="Technical-Vocational-Livelihood">TVL</option>
            </select></label>
            <label>Strand / Program<select value={shsProgram} disabled={!shsTrack} onChange={e=>setShsProgram(e.target.value)}>
              <option value="">Select Strand / Program</option>{(strands[shsTrack]??[]).map(s=><option key={s.value} value={s.value}>{s.label}</option>)}
            </select></label>
          </>}
        </div>
        <p className={styles.note}>Student login uses the LRN. Other learner details can be completed later in Learner Management.</p>
      </section>:<section className={styles.formSection}>
        <h2>{kind==="teacher"?"Teaching Personnel Information":"Non-Teaching Personnel Information"}</h2>
        <div className={styles.formGrid}>
          <label>Full Name <input required value={fullName} maxLength={180} placeholder="Complete official name" onChange={e=>setFullName(e.target.value)}/></label>
          <label>{kind==="teacher"?"Teaching Position":"Designation"} <select required value={position} onChange={e=>setPosition(e.target.value)}>
            <option value="">Select Position</option>
            {(kind==="teacher"?teachingPositions:nonTeachingPositions).map(p=><option key={p} value={p}>{p}</option>)}
          </select></label>
          <label>Login Email (Optional) <input type="email" value={email} maxLength={254} placeholder="name@deped.gov.ph" onChange={e=>setEmail(e.target.value)}/></label>
          <label>Mobile Number (Optional) <input value={phone} maxLength={18} placeholder="09XXXXXXXXX" onChange={e=>setPhone(e.target.value)}/></label>
          {kind==="non_teaching"&&<label className={styles.fullWidth}>Staff Access Role (Required)
            <select required value={adminRole} onChange={e=>setAdminRole(e.target.value)}>
              <option value="">Choose Access Role</option>
              {Object.entries(roleLabels).map(([id,name])=><option value={id} key={id}>{name}</option>)}
            </select>
          </label>}
          {kind==="non_teaching"&&<fieldset className={styles.permissions}>
            <legend>Staff Permissions (Optional, Select Only What's Needed)</legend>
            {staffPermissions.map(p=><label key={p.id}>
              <input type="checkbox" checked={accessPermissions.includes(p.id)}
                onChange={e=>setAccessPermissions(prev=>e.target.checked?[...prev,p.id]:prev.filter(id=>id!==p.id))}/>
              {p.label}
            </label>)}
          </fieldset>}
        </div>
        <p className={styles.note}>
          Leave Email blank to issue a temporary, non-deliverable login address.
          Replace it with the official email when available.
          {kind==="non_teaching"&&" The access role identifies the staff account type. Portal permissions are granted only through the checkboxes above; leave any unnecessary permission unchecked."}
        </p>
      </section>}
      {kind==="student"&&<label className={styles.phoneLabel}>Guardian / Recovery Mobile (Optional)
        <input value={phone} maxLength={18} placeholder="09XXXXXXXXX" onChange={e=>setPhone(e.target.value)}/>
      </label>}
      <div className={styles.actions}>
        <a href="/portal/admin/users">Cancel</a>
        <button type="submit" disabled={!isValid||busy||!loaded}><UserPlus size={17}/>{busy?"Creating Account…":"Create Account"}</button>
      </div>
    </form>:<section className={styles.panel}>
      <div className={styles.successHeader}><CheckCircle2 size={26}/><div><h2>Account Created Successfully</h2>
        <p>The temporary credentials are available here only for this one-time setup. Download and give them privately to the new user.</p></div></div>
      <div className={styles.credentialBox}>
        <div><span>Full Name</span><strong>{created.full_name}</strong></div>
        <div><span>Login ID</span><strong>{created.identifier}</strong></div>
        <div><span>Temporary Password</span><strong className={styles.password}>{created.temporary_password}</strong></div>
        {created.access_role&&<div><span>Access Role</span><strong>{roleLabels[created.access_role]??created.access_role}</strong></div>}
      </div>
      <div className={styles.successActions}>
        <button type="button" onClick={download}><Download size={17}/>{downloaded?"Download Credentials Again":"Download Credentials CSV"}</button>
        <button className={styles.secondaryButton} type="button" onClick={resetForAnother}><UserPlus size={16}/>Create Another Account</button>
        <a href="/portal/admin/users">Back to Users &amp; Accounts</a>
      </div>
      <p className={styles.note}><KeyRound size={15}/> Password change is required at first login. Do not share the downloaded CSV in a public group.</p>
    </section>}
    <footer className={styles.footer}><a href="/portal/admin/masterlist">Need to create multiple accounts? Use Bulk Account Import.</a></footer>
  </div></main>;
}
