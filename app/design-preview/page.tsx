"use client";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowUpRight, BookOpen, CalendarDays, ClipboardCheck, ChevronRight, LayoutDashboard, Users } from "lucide-react";
import { PortalDesignPreview } from "@/components/portal/portal-shell";
import PortalLoadingScreen from "@/components/portal/portal-loading";
import { TopVisitorsView } from "@/components/portal/top-visitors-card";
import LearningLaunchpad from "@/components/learning/learning-launchpad";
import WorkspaceDirectory from "@/components/portal/workspace-directory";

function Design() {
  const params=useSearchParams();
  const student=params.get("role")==="student";
  if(params.get("screen")==="loading") return <PortalLoadingScreen />;
  const names=["Alex Rivera","Ari Santos","Cameron Reyes","Casey Cruz","Dana Flores","Drew Torres","Eden Garcia","Ellis Ramos","Emery Lim","Finley Gomez","Harper Diaz","Jamie Lopez","Jules Perez","Kai Mendoza","Lane Castillo","Mica Tan","Morgan Aguilar","Riley Aquino","Rowan Navarro","Sky Romero"];
  const report={period_start:"2026-10-26",period_end:"2026-11-24",tracking_started_on:"2026-10-26",visitors:names.map((full_name,i)=>({rank:i+1,full_name,visit_days:25-i,is_you:student&&i===0}))};
  const actions=student?[["Learning resources","Modules, reviewers, and activities",BookOpen],["My grades","View your academic progress",ClipboardCheck],["Class schedule","Your classes for the week",CalendarDays]]:[["Attendance","Record your class attendance",ClipboardCheck],["My learners","Open your advisory class",Users],["School forms","Prepare SF2, SF9, and SF10",BookOpen]];
  return <PortalDesignPreview student={student}>
    <main className="workspace"><div className="page-wrap">
      <div className="page-heading"><div><p className="eyebrow">ASUNCION NATIONAL HIGH SCHOOL · SCHOOL YEAR 2026–2027</p><h1>Welcome, {student?"Alex Rivera":"Alex Morgan"}.</h1><p>Your academic information and school tools in one place.</p></div></div>
      <p style={{fontSize:11,color:"#63775f",margin:"-10px 0 18px"}}>Design preview · Fictional names and records for layout review</p>
      <div className="real-overview-grid">
      <section className="panel real-dashboard-home"><div className="real-dashboard-heading"><div><span className="real-dashboard-kicker">YOUR SCHOOL WORKSPACE</span><h2>{student?"Ready to learn?":"A good day to make progress."}</h2><p>{student?"Find your learning tools and school updates.":"Your most useful tools, ready when you need them."}</p></div><span className="real-dashboard-role">{student?"Student":"Teacher · Class Adviser"}</span></div>
      <div className="real-dashboard-summary">{(student?[["Grade level","Grade 8"],["Section","Sample Section"],["School year","2026–2027"]]:[["Advisory class","Grade 8"],["Learners","40"],["Teaching loads","5"]]).map(([label,value])=><div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
      <div className="real-dashboard-actions">{actions.map(([title,detail,Icon])=><a key={String(title)} className="real-dashboard-action" href="#"><span className="real-dashboard-action-icon">{typeof Icon!=="string"&&<Icon size={20}/>}</span><span className="real-dashboard-action-copy"><strong>{String(title)}</strong><small>{String(detail)}</small></span><ArrowUpRight size={16} className="real-dashboard-action-arrow"/></a>)}</div>
      <LearningLaunchpad role={student?"student":"teacher"}/></section>
      <TopVisitorsView report={report} loading={false} error="" onRefresh={()=>{}}/>
      <details className="portal-tool-directory"><summary><span><LayoutDashboard size={18}/><strong>Browse all school tools</strong></span><ChevronRight size={17}/></summary><WorkspaceDirectory/></details>
      </div>
    </div></main>
  </PortalDesignPreview>;
}
export default function DesignPreviewPage(){return <Suspense fallback={<PortalLoadingScreen/>}><Design/></Suspense>;}
