"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, RefreshCw, Users } from "lucide-react";
import { STEM_GROUPS } from "@/lib/shs-stem-groups";

type Section = { id: string; name: string };
type Learner = { enrollmentId: string; studentId: string; fullName: string; lrn: string | null; group: string };
type Data = { year: { name: string } | null; sections: Section[]; learners: Learner[] };

export default function StemElectiveGroupsPage() {
  const [data, setData] = useState<Data>({ year: null, sections: [], learners: [] });
  const [sectionId, setSectionId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async (selectedId: string) => {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/admin/stem-elective-groups?sectionId=" + encodeURIComponent(selectedId), { cache: "no-store" });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? "Cannot load STEM learners.");
      setData(result);
      if (!selectedId && result.sections?.length) setSectionId(result.sections[0].id);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Cannot load STEM learners.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(sectionId); }, [sectionId, load]);

  async function assign(learner: Learner, group: string) {
    setSaving(learner.enrollmentId); setError(""); setMessage("");
    try {
      const response = await fetch("/api/admin/stem-elective-groups", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sectionId, enrollmentId: learner.enrollmentId, group }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? "Unable to save elective group.");
      setData((current) => ({ ...current, learners: current.learners.map((row) =>
        row.enrollmentId === learner.enrollmentId ? { ...row, group } : row
      ) }));
      setMessage("Saved elective group for " + learner.fullName + ".");
    } catch (error) { setError(error instanceof Error ? error.message : "Unable to assign elective group."); }
    finally { setSaving(""); }
  }

  const assigned = data.learners.filter((row) => Boolean(row.group)).length;
  return (
    <main style={{minHeight:"100vh",background:"#f4f8fb",padding:"30px 16px",color:"#20445a"}}>
      <div style={{maxWidth:1080,margin:"0 auto",display:"grid",gap:17}}>
        <nav style={{display:"flex",justifyContent:"space-between",gap:15,alignItems:"center"}}>
          <a href="/portal/admin/school-setup" style={{color:"#146b8c",display:"inline-flex",alignItems:"center",gap:7}}><ArrowLeft size={16}/> School Setup</a>
          <button type="button" onClick={() => void load(sectionId)} disabled={loading} style={{padding:"8px 11px",border:"1px solid #d5e3e9",borderRadius:9,background:"#fff",display:"inline-flex",gap:6,alignItems:"center"}}><RefreshCw size={15}/> Refresh</button>
        </nav>
        <div>
          <div style={{fontSize:11,letterSpacing:2,fontWeight:800,color:"#26826f"}}>GRADE 11 · STEM</div>
          <h1 style={{fontSize:31,margin:"5px 0 9px"}}>Elective Group Assignment</h1>
          <p style={{fontSize:14,color:"#617e90"}}>One STEM advisory section. Assign each learner to Medical or Engineering for elective subjects, teacher loads and SF9 grades. The official program stays STEM.</p>
        </div>
        {error && <div role="alert" style={{color:"#a64242",background:"#fff1f1",padding:13,borderRadius:9}}>{error}</div>}
        {message && <div role="status" style={{color:"#267650",background:"#eafaef",padding:13,borderRadius:9}}>{message}</div>}
        <section style={{background:"#fff",padding:20,border:"1px solid #dbe7ed",borderRadius:14}}>
          <label htmlFor="stem-section" style={{display:"grid",gap:8,fontSize:13,fontWeight:750}}>
            STEM Section · {data.year?.name ?? "Active School Year"}
            <select id="stem-section" value={sectionId} onChange={(event) => setSectionId(event.target.value)}
              style={{height:42,padding:"0 12px",border:"1px solid #cadce5",borderRadius:9,background:"#fff"}}>
              <option value="">Select STEM Section</option>
              {data.sections.map((section) => <option key={section.id} value={section.id}>Grade 11 · {section.name} (STEM)</option>)}
            </select>
          </label>
        </section>
        <section style={{background:"#fff",border:"1px solid #dbe7ed",borderRadius:14,overflow:"hidden"}}>
          <div style={{padding:18,borderBottom:"1px solid #e5eef1",display:"flex",justifyContent:"space-between",gap:12,alignItems:"center"}}>
            <strong style={{display:"inline-flex",alignItems:"center",gap:8}}><Users size={18}/> Section Learners</strong>
            <span style={{fontSize:12,color:"#577e8b"}}>{assigned}/{data.learners.length} assigned</span>
          </div>
          {loading ? <p style={{padding:20}}>Loading section learners…</p> :
            !sectionId ? <p style={{padding:20,color:"#718693"}}>Choose a STEM section above.</p> :
            data.learners.length === 0 ? <p style={{padding:20,color:"#718693"}}>No active learners have been enrolled in this section yet.</p> :
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",minWidth:520}}>
                <thead><tr style={{background:"#f1f7fa",textAlign:"left",fontSize:12}}>
                  <th style={{padding:13}}>Learner</th><th style={{padding:13}}>LRN</th><th style={{padding:13}}>Elective Group</th>
                </tr></thead>
                <tbody>{data.learners.map((learner) => <tr key={learner.enrollmentId} style={{borderTop:"1px solid #e8f0f3"}}>
                  <td style={{padding:13,fontWeight:650,fontSize:13}}>{learner.fullName}</td>
                  <td style={{padding:13,fontSize:12}}>{learner.lrn ?? "—"}</td>
                  <td style={{padding:13}}>
                    <select aria-label={"Elective group for "+learner.fullName} value={learner.group}
                      disabled={saving === learner.enrollmentId}
                      onChange={(event) => void assign(learner, event.target.value)}
                      style={{minWidth:190,height:37,border:"1px solid #c8dfe2",borderRadius:8,background:"#fff",padding:"0 10px"}}>
                      <option value="">Not Assigned</option>
                      {STEM_GROUPS.map((group) => <option key={group.code} value={group.code}>{group.shortLabel}</option>)}
                    </select>
                  </td>
                </tr>)}</tbody>
              </table>
            </div>}
        </section>
        <p style={{fontSize:12,color:"#708997"}}>Changing a learner's elective group does not move them to a different section or automatically copy their grades. Assign the group before encoding elective grades.</p>
        <a href="/portal/admin/teaching" style={{color:"#176b92",fontWeight:700,fontSize:13}}>Continue to Subject Teacher Assignments →</a>
      </div>
    </main>
  );
}
