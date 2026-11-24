"use client";

import { FormEvent, useEffect, useState } from "react";
import { BookOpen, CheckCircle2, ClipboardList, FileDown, HeartHandshake, Pencil, Plus, Printer, Save } from "lucide-react";
import { usePortal } from "@/components/portal/portal-shell";
import { ARAL_AREAS, csvCell, learningCheckLabel, sameTutorClass } from "@/lib/learning-workspaces";
import styles from "@/components/learning/workspaces.module.css";

type Plan = { id: string; school_year_id: string; student_id: string; tutor_id: string; student_name: string; tutor_name: string; grade_level: number; section_name: string; focus_area: string; target_skill: string; assessment_basis: string; learner_instructions: string; resource_url: string; status: string; updated_at: string };
type SupportSession = { id: string; plan_id: string; session_date: string; activity: string; attendance: string; assessment_name: string; score: number | null; max_score: number | null; feedback: string; next_steps: string; resource_url: string; updated_at: string };
type LearnerResponse = { session_id: string; message: string; completed: boolean; needs_help: boolean; updated_at: string };
type Context = { year: { id: string; name: string } | null; learners: { id: string; full_name: string; grade_level: number; section_id: string; section: string }[]; tutors: { id: string; full_name: string }[]; assignments: { teacher_id: string; co_teacher_ids: string[] | null; section_id: string }[]; advisers: { teacher_id: string; section_id: string }[] };
const emptyPlan = (year = "") => ({ school_year_id: year, student_id: "", tutor_id: "", focus_area: "Reading", target_skill: "", assessment_basis: "", learner_instructions: "", resource_url: "", status: "active" });
function today() {
  const parts = new Intl.DateTimeFormat("en", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const get = (key: string) => parts.find(p => p.type === key)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}
const emptySession = (id = "") => ({ plan_id: id, session_date: today(), activity: "", attendance: "scheduled", assessment_name: "", score: "", max_score: "", feedback: "", next_steps: "", resource_url: "" });
async function api(url: string, init?: RequestInit) {
  let r = await fetch(url, { cache: "no-store", ...init });
  if (r.status === 401 && url !== "/api/auth/me") {
    const refresh = await fetch("/api/auth/me", { cache: "no-store" });
    if (refresh.ok) r = await fetch(url, { cache: "no-store", ...init });
  }
  const x = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(x.error ?? "Unable to reach ARAL support.");
  return x;
}
export default function AralPage() {
  const { session } = usePortal();
  const role = session.profile.role;
  const coordinator = role === "administrator";
  const learner = role === "student";
  const allowed = coordinator || learner || role === "teacher";
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selected, setSelected] = useState<Plan | null>(null);
  const [sessions, setSessions] = useState<SupportSession[]>([]);
  const [responses, setResponses] = useState<LearnerResponse[]>([]);
  const [context, setContext] = useState<Context | null>(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [dirtyResponseIds, setDirtyResponseIds] = useState<Set<string>>(() => new Set());
  const responseDirty = dirtyResponseIds.size > 0;
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [planForm, setPlanForm] = useState<ReturnType<typeof emptyPlan> | null>(null);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [gradeFilter, setGradeFilter] = useState(7);
  const [learnerSearch, setLearnerSearch] = useState("");
  const [sessionForm, setSessionForm] = useState<ReturnType<typeof emptySession> | null>(null);
  const [editingSession, setEditingSession] = useState<SupportSession | null>(null);

  async function loadPlans(next = 0) {
    const x = await api(`/api/aral?page=${next}&archived=${showArchived ? 1 : 0}`);
    setPlans(p => next ? [...p, ...x.plans] : x.plans); setPage(next); setHasMore(x.hasMore);
  }
  useEffect(() => {
    let active = true;
    if (!allowed) { setLoading(false); return; }
    async function load() {
      try {
        const [x,c] = await Promise.all([api(`/api/aral?archived=${showArchived ? 1 : 0}`), coordinator ? api("/api/aral?context=1") : Promise.resolve(null)]);
        if (!active) return;
        setPlans(x.plans); setHasMore(x.hasMore); setContext(c);
      } catch (e) { if (active) setError(e instanceof Error ? e.message : "Unable to load support plans."); }
      finally { if (active) setLoading(false); }
    }
    void load(); return () => { active = false; };
  }, [allowed, coordinator, showArchived]);
  useEffect(() => {
    const dirty = !!planForm || !!sessionForm || responseDirty;
    const unload = (event: BeforeUnloadEvent) => { if (dirty) { event.preventDefault(); event.returnValue = ""; } };
    const navigate = (event: Event) => { if (dirty && !window.confirm("Leave the unsaved ARAL form?")) event.preventDefault(); };
    window.addEventListener("beforeunload", unload); window.addEventListener("anhs-before-navigate", navigate);
    return () => { window.removeEventListener("beforeunload", unload); window.removeEventListener("anhs-before-navigate", navigate); };
  }, [planForm, sessionForm, responseDirty]);
  async function openPlan(id: string) {
    if ((planForm || sessionForm || responseDirty) && !window.confirm("Close the unsaved form and open this support plan?")) return;
    setWorking("open"); setError(""); setSuccess("");
    try {
      const x = await api(`/api/aral?id=${id}`);
      setSelected(x.plan); setSessions(x.sessions); setResponses(x.responses); setPlanForm(null); setSessionForm(null); setDirtyResponseIds(new Set());
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to open this support plan."); }
    finally { setWorking(""); }
  }
  async function refreshSelected(id: string) {
    const x = await api(`/api/aral?id=${id}`);
    setSelected(x.plan); setSessions(x.sessions); setResponses(x.responses);
  }
  function newAssignment() {
    if ((planForm || sessionForm) && !window.confirm("Close the current unsaved form?")) return;
    setPlanForm(emptyPlan(context?.year?.id)); setEditingPlan(null); setSessionForm(null); setLearnerSearch(""); setError(""); setSuccess("");
  }
  function editAssignment() {
    if (!selected) return;
    if (sessionForm && !window.confirm("Close the unsaved session form?")) return;
    setPlanForm({ school_year_id: selected.school_year_id, student_id: selected.student_id, tutor_id: selected.tutor_id, focus_area: selected.focus_area, target_skill: selected.target_skill, assessment_basis: selected.assessment_basis, learner_instructions: selected.learner_instructions, resource_url: selected.resource_url, status: selected.status });
    setEditingPlan(selected); setSessionForm(null); setGradeFilter(selected.grade_level);
  }
  async function saveAssignment(event: FormEvent) {
    event.preventDefault(); if (!planForm) return;
    setWorking("save-plan"); setError(""); setSuccess("");
    try {
      const x = await api("/api/aral", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "plan", plan: planForm, id: editingPlan?.id, expected_updated_at: editingPlan?.updated_at }) });
      await refreshSelected(x.plan.id); await loadPlans(); setPlanForm(null); setSuccess("Support assignment saved. The learner and tutor can access it through their own accounts.");
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to save the assignment."); }
    finally { setWorking(""); }
  }
  function editSession(value?: SupportSession) {
    if (!selected) return;
    if ((sessionForm || planForm) && !window.confirm("Replace the unsaved support form?")) return;
    setEditingSession(value ?? null); setPlanForm(null);
    setSessionForm(value ? { plan_id: value.plan_id, session_date: value.session_date, activity: value.activity, attendance: value.attendance, assessment_name: value.assessment_name, score: value.score === null ? "" : String(value.score), max_score: value.max_score === null ? "" : String(value.max_score), feedback: value.feedback, next_steps: value.next_steps, resource_url: value.resource_url } : emptySession(selected.id));
  }
  async function saveSession(event: FormEvent) {
    event.preventDefault(); if (!sessionForm || !selected) return;
    setWorking("save-session"); setError(""); setSuccess("");
    try {
      await api("/api/aral", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "session", session: sessionForm, id: editingSession?.id, expected_updated_at: editingSession?.updated_at }) });
      await refreshSelected(selected.id); setSessionForm(null); setSuccess("Session saved. Its activity and feedback are available to the learner.");
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to save the session."); }
    finally { setWorking(""); }
  }
  async function respond(event: FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault(); if (!selected) return;
    const data = new FormData(event.currentTarget);
    setWorking("response"); setError(""); setSuccess("");
    try {
      await api("/api/aral", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "response", session_id: id, message: data.get("message"), completed: data.get("completed") === "on", needs_help: data.get("needs_help") === "on" }) });
      await refreshSelected(selected.id); setDirtyResponseIds(old => { const next = new Set(old); next.delete(id); return next; }); setSuccess("Your response was sent to your tutor.");
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to send your response."); }
    finally { setWorking(""); }
  }
  function downloadProgress() {
    if (!selected) return;
    const rows = [["Learner", "Grade", "Section", "Tutor", "Focus area", "Target skill", "Date", "Attendance", "Activity", "Learning check", "Score", "Maximum", "Tutor feedback", "Next steps", "Activity completed by learner", "Learner needs help", "Learner message"], ...sessions.map(s => {
      const r = responses.find(r => r.session_id === s.id);
      return [selected.student_name, selected.grade_level, selected.section_name, selected.tutor_name, selected.focus_area, selected.target_skill, s.session_date, s.attendance, s.activity, s.assessment_name, s.score, s.max_score, s.feedback, s.next_steps, r?.completed ? "Yes" : "No", r?.needs_help ? "Yes" : "No", r?.message ?? ""];
    })];
    const url = URL.createObjectURL(new Blob(["\ufeff" + rows.map(row => row.map(csvCell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = "ANHS_ARAL_Support_Progress.csv"; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  if (!allowed) return <main className={styles.page}><div className={styles.empty}><HeartHandshake size={30}/><strong>ARAL support is available to learners, assigned tutors, and school administrators.</strong></div></main>;
  const chosenLearner = context?.learners.find(l => l.id === planForm?.student_id);
  const eligibleTutors = context?.tutors.filter(t => !chosenLearner || !sameTutorClass(t.id, chosenLearner.section_id, context.assignments, context.advisers)) ?? [];
  const canRecord = !!selected && selected.status === "active" && (coordinator || (role === "teacher" && selected.tutor_id === session.profile.id));
  const setPlanField = (key: keyof ReturnType<typeof emptyPlan>, value: string) => setPlanForm(old => old ? { ...old, [key]: value } : old);
  const setSessionField = (key: keyof ReturnType<typeof emptySession>, value: string) => setSessionForm(old => old ? { ...old, [key]: value } : old);
  return <main className={styles.page}>
    <header className={styles.hero}><div><span className={styles.eyebrow}>TEACHING & LEARNING · ARAL</span><h1>{learner ? "Small steps. Steady progress." : "Support that meets learners where they are."}</h1><p>{learner ? "Find your tutor’s activities, revisit feedback, and ask for help when you need it." : "Coordinate Junior High School support, prepare activities, and keep a clear record of each learner’s progress."}</p></div><div className={styles.heroIcon}><HeartHandshake/></div></header>
    {error && <div className={styles.error} role="alert">{error}</div>}{success && <div className={styles.success} role="status">{success}</div>}
    <div className={`${styles.notice} ${styles.noPrint}`}>ARAL support is ungraded. Session attendance and learning checks stay separate from SF2 attendance and SF9 grades.</div>
    <div className={styles.workspace}><aside className={styles.aside}><h2>{learner ? "My support plans" : "Support plans"}</h2>{coordinator && <button className={`${styles.button} ${styles.full}`} onClick={newAssignment} disabled={!!working || !context?.year}><Plus size={16}/>Assign learner support</button>}<p>{coordinator ? "Create assignments using the school’s verified assessment and referral records." : learner ? "Only support assigned to your account appears here." : "Only learners assigned to you as tutor appear here."}</p><label className={styles.archiveToggle}><input type="checkbox" checked={showArchived} disabled={!!working} onChange={e => setShowArchived(e.target.checked)}/>Show archived plans</label><div className={styles.savedList}>{loading ? <p className={styles.hint}>Loading support plans…</p> : plans.map(p => <button key={p.id} className={`${styles.savedItem} ${selected?.id === p.id ? styles.selected : ""}`} onClick={() => void openPlan(p.id)} disabled={!!working}><strong>{learner ? p.focus_area : p.student_name}</strong><small>{learner ? p.target_skill : `Grade ${p.grade_level} · ${p.section_name}`}<br/>{p.focus_area} · {p.status}</small></button>)}</div>{!loading && !plans.length && <div className={styles.empty}><BookOpen size={25}/><strong>No support plans yet</strong><p>{coordinator ? "Assign a learner and tutor to begin." : "Assigned support will appear here when your school administrator creates a plan."}</p></div>}{hasMore && <button className={`${styles.quiet} ${styles.full}`} onClick={() => void loadPlans(page + 1).catch(e => setError(e.message))}>Load more plans</button>}</aside>
      <fieldset className={`${styles.main} ${styles.fieldset}`} disabled={!!working} aria-label="ARAL support workspace">
        {planForm && coordinator && <form className={`${styles.card} ${styles.noPrint}`} onSubmit={saveAssignment}><div className={styles.cardHead}><div><h2>{editingPlan ? "Edit support assignment" : "Assign learner support"}</h2><p>{context?.year?.name} · Grades 7–10</p></div><span className={styles.badge}>School administrator</span></div><div className={styles.formGrid}>
          {!editingPlan && <><label className={styles.field}>Grade level<select value={gradeFilter} onChange={e => { setGradeFilter(Number(e.target.value)); setPlanField("student_id", ""); setPlanField("tutor_id", ""); }}>{[7,8,9,10].map(g => <option key={g} value={g}>Grade {g}</option>)}</select></label><label className={styles.field}>Find learner<input value={learnerSearch} onChange={e => setLearnerSearch(e.target.value)} placeholder="Filter by name or section"/></label></>}
          <label className={`${styles.field} ${styles.wide}`}>Learner{editingPlan ? <input value={`${editingPlan.student_name} · Grade ${editingPlan.grade_level} ${editingPlan.section_name}`} disabled/> : <select required value={planForm.student_id} onChange={e => { setPlanField("student_id", e.target.value); setPlanField("tutor_id", ""); }}><option value="">Select learner</option>{context?.learners.filter(l => l.grade_level === gradeFilter && `${l.full_name} ${l.section}`.toLowerCase().includes(learnerSearch.toLowerCase())).map(l => <option key={l.id} value={l.id}>{l.full_name} · {l.section}</option>)}</select>}</label>
          <label className={`${styles.field} ${styles.wide}`}>Assigned tutor<select required value={planForm.tutor_id} onChange={e => setPlanField("tutor_id", e.target.value)}><option value="">Select tutor</option>{editingPlan && !eligibleTutors.some(t => t.id === editingPlan.tutor_id) && <option value={editingPlan.tutor_id}>{editingPlan.tutor_name} · Existing assignment</option>}{eligibleTutors.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}</select><small>Teachers currently teaching or advising the learner’s section are excluded from new tutor assignments.</small></label>
          <label className={styles.field}>Focus area<select value={planForm.focus_area} onChange={e => setPlanField("focus_area", e.target.value)}>{ARAL_AREAS.map(a => <option key={a}>{a}</option>)}</select></label><label className={styles.field}>Support status<select value={planForm.status} onChange={e => setPlanField("status", e.target.value)}>{["active","paused","completed","archived"].map(s => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}</select></label>
          <label className={`${styles.field} ${styles.wide}`}>Target skill<input required value={planForm.target_skill} maxLength={500} onChange={e => setPlanField("target_skill", e.target.value)} placeholder="e.g. Identify the main idea and supporting details"/></label>
          <label className={`${styles.field} ${styles.wide}`}>Assessment / referral basis<textarea required value={planForm.assessment_basis} maxLength={5000} onChange={e => setPlanField("assessment_basis", e.target.value)} placeholder="Record the verified assessment, date, and skills identified for support."/><small>The school determines eligibility. This record documents its assessment-based referral.</small></label>
          <label className={`${styles.field} ${styles.wide}`}>Instructions for the learner<textarea value={planForm.learner_instructions} maxLength={8000} onChange={e => setPlanField("learner_instructions", e.target.value)}/></label><label className={`${styles.field} ${styles.wide}`}>Learning resource link<input type="url" value={planForm.resource_url} onChange={e => setPlanField("resource_url", e.target.value)} placeholder="https://..."/><small>Use a resource the learner can access, such as an approved reading material or a shared worksheet.</small></label>
        </div><div className={styles.formActions}><button type="button" className={styles.secondary} onClick={() => setPlanForm(null)}>Cancel</button><button className={styles.button} type="submit"><Save size={15}/>{working === "save-plan" ? "Saving…" : "Save assignment"}</button></div></form>}
        {!selected && !planForm && <section className={styles.empty}><HeartHandshake size={38}/><strong>{learner ? "Your next step starts here." : "A place for every learner’s next step."}</strong><p>{learner ? "Open a support plan to see your tutor’s activities and feedback. You can also explore your class learning resources." : "Select a support plan to view sessions, learning checks, and learner responses."}</p><a className={styles.secondary} href="/portal/resources">Open learning resources</a></section>}
        {selected && <>
          <div className={styles.printOnly}><h1>Asuncion National High School</h1><p>ARAL Support Record · Ungraded learning support</p></div>
          <section className={styles.card}><div className={styles.cardHead}><div><span className={styles.eyebrow}>{selected.focus_area} · {selected.status}</span><h2>{selected.student_name}</h2><p>Grade {selected.grade_level} · {selected.section_name} · Tutor: {selected.tutor_name}</p></div><span className={styles.badge}>Ungraded support</span></div><h3>{selected.target_skill}</h3><p className={styles.detailText}>{selected.learner_instructions || "Your tutor will add activities and instructions for this skill."}</p>{selected.resource_url && <a className={styles.link} href={selected.resource_url} target="_blank" rel="noreferrer">Open assigned learning resource ↗</a>}{!learner && <><div className={styles.divider}/><p className={styles.hint}>Assessment / referral basis</p><p className={styles.detailText}>{selected.assessment_basis}</p></>}<div className={`${styles.formActions} ${styles.noPrint}`}>{coordinator && <button className={styles.secondary} onClick={editAssignment}><Pencil size={14}/>Edit assignment</button>}<button className={styles.secondary} onClick={() => window.print()}><Printer size={14}/>Print / Save PDF</button>{!learner && <button className={styles.secondary} onClick={downloadProgress}><FileDown size={14}/>Progress CSV</button>}</div></section>
          <div className={`${styles.metrics} ${styles.noPrint}`}><div className={styles.metric}><small>Sessions recorded</small><strong>{sessions.length}</strong></div><div className={styles.metric}><small>Sessions attended</small><strong>{sessions.filter(s => s.attendance === "present").length}</strong></div><div className={styles.metric}><small>Help requests</small><strong>{responses.filter(r => r.needs_help).length}</strong></div></div>
          <div className={`${styles.toolbar} ${styles.noPrint}`}><div><h2>Activities and progress</h2><p>Learning checks are recorded with their assessment name and maximum score.</p></div>{canRecord && <button className={styles.button} onClick={() => editSession()}><Plus size={15}/>Add session</button>}</div>
          {sessionForm && canRecord && <form className={`${styles.card} ${styles.noPrint}`} onSubmit={saveSession}><div className={styles.cardHead}><div><h2>{editingSession ? "Edit session" : "New support session"}</h2><p>Activity instructions and feedback are visible to this learner.</p></div></div><div className={styles.formGrid}>
            <label className={styles.field}>Session date<input type="date" required value={sessionForm.session_date} onChange={e => setSessionField("session_date", e.target.value)}/></label><label className={styles.field}>Session attendance<select value={sessionForm.attendance} onChange={e => setSessionField("attendance", e.target.value)}>{["scheduled","present","absent","excused"].map(s => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}</select></label>
            <label className={`${styles.field} ${styles.wide}`}>Activity and learner instructions<textarea required rows={5} value={sessionForm.activity} maxLength={10000} onChange={e => setSessionField("activity", e.target.value)}/></label><label className={`${styles.field} ${styles.wide}`}>Learning-check name<input value={sessionForm.assessment_name} maxLength={180} onChange={e => setSessionField("assessment_name", e.target.value)} placeholder="e.g. Main-idea check, 5 items"/></label>
            <label className={styles.field}>Score <small>Optional; leave both score fields blank if no check was given.</small><input type="number" min={0} max={100000} step="0.01" value={sessionForm.score} onChange={e => setSessionField("score", e.target.value)}/></label><label className={styles.field}>Maximum score<input type="number" min="0.01" max={100000} step="0.01" value={sessionForm.max_score} onChange={e => setSessionField("max_score", e.target.value)}/></label>
            <label className={`${styles.field} ${styles.wide}`}>Feedback for the learner<textarea value={sessionForm.feedback} maxLength={8000} onChange={e => setSessionField("feedback", e.target.value)} placeholder="Explain what the learner did well and one useful next step."/></label><label className={`${styles.field} ${styles.wide}`}>Next steps<textarea value={sessionForm.next_steps} maxLength={5000} onChange={e => setSessionField("next_steps", e.target.value)}/></label><label className={`${styles.field} ${styles.wide}`}>Session resource link<input type="url" value={sessionForm.resource_url} onChange={e => setSessionField("resource_url", e.target.value)} placeholder="https://..."/></label>
          </div><div className={styles.formActions}><button className={styles.secondary} type="button" onClick={() => setSessionForm(null)}>Cancel</button><button type="submit" className={styles.button}><Save size={15}/>{working === "save-session" ? "Saving…" : "Save session"}</button></div></form>}
          {!sessions.length && <div className={styles.empty}><ClipboardList size={28}/><strong>No sessions recorded yet</strong><p>{learner ? "Your tutor will post your first activity here." : "Add the first session when an activity has been planned."}</p></div>}
          <div>{sessions.map(s => { const response = responses.find(r => r.session_id === s.id); return <article className={styles.sessionCard} key={s.id}><div className={styles.sessionMeta}><span>{s.session_date}</span><span className={styles.badge}>{s.attendance}</span>{response?.completed && <span className={styles.badge}><CheckCircle2 size={12}/>Learner finished activity</span>}{response?.needs_help && <span className={`${styles.badge} ${styles.alertBadge}`}>Help requested</span>}</div><h3>{s.assessment_name || "Support activity"}</h3><p className={styles.detailText}>{s.activity}</p>{s.resource_url && <a className={styles.link} href={s.resource_url} target="_blank" rel="noreferrer">Open session resource ↗</a>}{s.score !== null && <div className={styles.feedback}><strong>Learning check · {s.assessment_name}</strong>{learningCheckLabel(s.score, s.max_score)}</div>}{s.feedback && <div className={styles.feedback}><strong>Feedback from your tutor</strong>{s.feedback}</div>}{s.next_steps && <div className={styles.feedback}><strong>Next steps</strong>{s.next_steps}</div>}{!learner && response?.message && <div className={styles.feedback}><strong>Learner response</strong>{response.message}</div>}{canRecord && <button className={`${styles.quiet} ${styles.noPrint}`} onClick={() => editSession(s)}><Pencil size={13}/>Edit session</button>}
            {learner && selected.status === "active" && <form className={`${styles.responseForm} ${styles.noPrint}`} key={`${s.id}:${response?.updated_at ?? "new"}`} onSubmit={e => void respond(e, s.id)} onChange={() => setDirtyResponseIds(old => new Set(old).add(s.id))}><label className={styles.field}>Message to your tutor<textarea name="message" maxLength={5000} rows={3} defaultValue={response?.message ?? ""} placeholder="Tell your tutor what you understood or where you need help."/></label><div className={styles.responseChecks}><label><input type="checkbox" name="completed" defaultChecked={response?.completed ?? false}/>I finished this activity</label><label><input type="checkbox" name="needs_help" defaultChecked={response?.needs_help ?? false}/>I need help</label></div><div><button type="submit" className={styles.button}>{working === "response" ? "Sending…" : "Send response"}</button></div></form>}{learner && selected.status !== "active" && response?.message && <div className={styles.feedback}><strong>Your response</strong>{response.message}</div>}
          </article>; })}</div>
        </>}
      </fieldset>
    </div>
  </main>;
}
