"use client";

import { useEffect, useState } from "react";
import { Archive, BookOpen, CheckCircle2, Copy, FileDown, Lightbulb, Plus, Printer, Save } from "lucide-react";
import { usePortal } from "@/components/portal/portal-shell";
import { ILAW_SECTIONS, validateIlaw, type IlawContent, type IlawSession } from "@/lib/learning-workspaces";
import styles from "@/components/learning/workspaces.module.css";

type SavedPlan = { id: string; title: string; subject: string; grade_level: number; term_no: number; week_no: number; status: string; owner_id: string; updated_at: string; owner?: { full_name: string }; content?: IlawContent };
const emptySession = (): IlawSession => ({ intentions: "", learning_experiences: "", assessment: "", ways_forward: "" });
const emptyPlan = (): IlawContent => ({ title: "", subject: "", grade_level: 7, section: "", term_no: 1, week_no: 1, lesson_date: "", duration_minutes: 60, language: "English", competencies: "", learner_context: "", references: "", materials: "", sessions: [emptySession()] });
async function api(url: string, init?: RequestInit) {
  let r = await fetch(url, { cache: "no-store", ...init });
  if (r.status === 401 && url !== "/api/auth/me") {
    const refresh = await fetch("/api/auth/me", { cache: "no-store" });
    if (refresh.ok) r = await fetch(url, { cache: "no-store", ...init });
  }
  const x = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(x.error ?? "Unable to reach lesson planning.");
  return x;
}
export default function IlawPage() {
  const { session } = usePortal();
  const allowed = ["teacher", "administrator"].includes(session.profile.role);
  const [content, setContent] = useState<IlawContent>(emptyPlan);
  const [saved, setSaved] = useState<SavedPlan | null>(null);
  const [plans, setPlans] = useState<SavedPlan[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [activeSession, setActiveSession] = useState(0);
  const [reviewed, setReviewed] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [preview, setPreview] = useState(false);
  const [working, setWorking] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [teacherName, setTeacherName] = useState(session.profile.full_name);

  async function loadPlans(next = 0) {
    const x = await api(`/api/ilaw?page=${next}&archived=${showArchived ? 1 : 0}`);
    setPlans(old => next ? [...old, ...x.plans] : x.plans); setPage(next); setHasMore(x.hasMore);
  }
  useEffect(() => { if (allowed) void loadPlans().catch(e => setError(e.message)); }, [allowed, showArchived]);
  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => { if (dirty) { event.preventDefault(); event.returnValue = ""; } };
    const navigation = (event: Event) => { if (dirty && !window.confirm("Leave this lesson plan without saving your changes?")) event.preventDefault(); };
    window.addEventListener("beforeunload", handler);
    window.addEventListener("anhs-before-navigate", navigation);
    return () => { window.removeEventListener("beforeunload", handler); window.removeEventListener("anhs-before-navigate", navigation); };
  }, [dirty]);
  function change<K extends keyof IlawContent>(key: K, value: IlawContent[K]) {
    setContent(c => ({ ...c, [key]: value })); setDirty(true); setReviewed(false); setSuccess("");
  }
  function changeSession(key: keyof IlawSession, value: string) {
    change("sessions", content.sessions.map((s, i) => i === activeSession ? { ...s, [key]: value } : s));
  }
  function sessionCount(count: number) {
    if (count < content.sessions.length && !window.confirm("Remove the last session(s) and their unsaved content?")) return;
    change("sessions", Array.from({ length: count }, (_, i) => content.sessions[i] ?? emptySession()));
    setActiveSession(i => Math.min(i, count - 1));
  }
  function newPlan() {
    if (dirty && !window.confirm("Start a new plan without saving the current changes?")) return;
    setContent(emptyPlan()); setSaved(null); setReviewed(false); setDirty(false); setPreview(false); setActiveSession(0); setError(""); setSuccess(""); setTeacherName(session.profile.full_name);
  }
  async function openPlan(id: string) {
    if (dirty && !window.confirm("Open another plan without saving the current changes?")) return;
    setWorking("open"); setError(""); setSuccess("");
    try {
      const { plan } = await api(`/api/ilaw?id=${id}`);
      setContent(validateIlaw(plan.content)); setSaved(plan); setReviewed(plan.teacher_reviewed); setDirty(false); setPreview(true); setActiveSession(0); setTeacherName(plan.owner?.full_name ?? session.profile.full_name);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to open the plan."); }
    finally { setWorking(""); }
  }
  async function save(status: "draft" | "ready" | "archived") {
    setError(""); setSuccess(""); setWorking("save");
    try {
      const validated = validateIlaw(content, status === "ready");
      if (status === "ready" && !reviewed) throw new Error("Confirm your review before marking this plan ready.");
      const x = await api("/api/ilaw", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: saved?.id, expected_updated_at: saved?.updated_at, content: validated, status, teacher_reviewed: reviewed }) });
      setSaved(x.plan); setContent(validated); setDirty(false); setPreview(true); setReviewed(x.plan.teacher_reviewed);
      setSuccess(status === "archived" ? "Plan archived. Its record is retained." : status === "ready" ? "Your reviewed ILAW plan is saved and ready to export." : "Draft saved. You can continue editing it later.");
      await loadPlans();
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to save the plan."); }
    finally { setWorking(""); }
  }
  async function downloadWord() {
    if (!saved || dirty) return;
    setWorking("export"); setError("");
    try { await api("/api/auth/me"); window.location.assign(`/api/ilaw/export?id=${saved.id}`); }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to export the plan."); }
    finally { setWorking(""); }
  }
  function generate(print = false) {
    setError("");
    try { validateIlaw(content); setPreview(true); if (print) window.print(); }
    catch (e) { setError(e instanceof Error ? e.message : "Complete the lesson details first."); }
  }
  if (!allowed) return <main className={styles.page}><div className={styles.empty}><BookOpen size={32}/><strong>Lesson planning is for teaching personnel.</strong><p>Your learning materials and assigned support are available through Learning Resources and ARAL Support.</p><a className={styles.secondary} href="/portal/aral">Open ARAL Support</a></div></main>;
  const current = content.sessions[activeSession] ?? content.sessions[0];
  return <main className={styles.page}>
    <header className={`${styles.hero} ${styles.noPrint}`}><div><span className={styles.eyebrow}>TEACHING & LEARNING · ILAW</span><h1>A clear plan for every lesson.</h1><p>Bring your competencies, activities, and assessments together. Generate an editable ILAW plan, save your work, and prepare a copy for your class.</p></div><div className={styles.heroIcon}><Lightbulb/></div></header>
    {error && <div className={styles.error} role="alert">{error}</div>}{success && <div className={styles.success} role="status">{success}</div>}
    <div className={styles.workspace}>
      <aside className={styles.aside}><h2>Lesson plan library</h2><button className={`${styles.button} ${styles.full}`} onClick={newPlan} disabled={!!working}><Plus size={16}/>New lesson plan</button><p>Your saved drafts and reviewed plans. School administrators can also review teachers’ saved plans.</p><label className={styles.archiveToggle}><input type="checkbox" checked={showArchived} disabled={!!working} onChange={e => setShowArchived(e.target.checked)}/>Show archived plans</label><div className={styles.savedList}>{plans.map(p => <button key={p.id} className={`${styles.savedItem} ${saved?.id === p.id ? styles.selected : ""}`} onClick={() => void openPlan(p.id)} disabled={!!working}><strong>{p.title}</strong><small>{p.subject} · Grade {p.grade_level}<br/>Term {p.term_no} · Week {p.week_no} · {p.status === "ready" ? "Reviewed" : "Draft"}</small>{session.profile.role === "administrator" && <small>{p.owner?.full_name}</small>}</button>)}{!plans.length && <div className={styles.empty}><BookOpen size={24}/><p>Your saved plans will appear here.</p></div>}</div>{hasMore && <button className={`${styles.quiet} ${styles.full}`} onClick={() => void loadPlans(page + 1).catch(e => setError(e.message))}>Load older plans</button>}</aside>
      <fieldset className={`${styles.main} ${styles.fieldset}`} disabled={!!working} aria-label="ILAW lesson plan editor">
        <div className={`${styles.toolbar} ${styles.noPrint}`}><span className={`${styles.badge} ${dirty ? styles.mutedBadge : ""}`}>{dirty ? "Unsaved changes" : saved ? saved.status === "ready" ? "Teacher-reviewed" : saved.status === "archived" ? "Archived" : "Draft saved" : "New plan"}</span><div className={styles.row}><button className={styles.secondary} onClick={() => generate()}><BookOpen size={15}/>Generate preview</button><button className={styles.secondary} onClick={() => generate(true)}><Printer size={15}/>Print / Save PDF</button><button className={styles.secondary} disabled={!saved || dirty || !!working} onClick={() => void downloadWord()} title={dirty || !saved ? "Save the current plan before downloading Word." : "Download the saved plan as an editable Word document."}><FileDown size={15}/>Word</button></div></div>
        <section className={`${styles.card} ${styles.editor}`}><div className={styles.cardHead}><div><h2>Lesson details</h2><p>Use your actual BOW, curriculum references, and classroom context.</p></div><span className={styles.badge}>Teacher-led</span></div><div className={styles.formGrid}>
          <label className={`${styles.field} ${styles.wide}`}>Lesson title<input value={content.title} maxLength={180} onChange={e => change("title", e.target.value)} placeholder="e.g. Assembling and disassembling a computer"/></label>
          <label className={styles.field}>Learning area<input value={content.subject} maxLength={120} onChange={e => change("subject", e.target.value)} placeholder="e.g. TVE – Computer Systems Servicing"/></label>
          <label className={styles.field}>Grade level<select value={content.grade_level} onChange={e => change("grade_level", Number(e.target.value))}>{[7,8,9,10,11,12].map(g => <option key={g} value={g}>Grade {g}</option>)}</select></label>
          <label className={styles.field}>Section / group<input value={content.section} maxLength={120} onChange={e => change("section", e.target.value)} placeholder="Section or learner group"/></label>
          <label className={styles.field}>Lesson date<input type="date" value={content.lesson_date} onChange={e => change("lesson_date", e.target.value)}/></label>
          <label className={styles.field}>Term<select value={content.term_no} onChange={e => change("term_no", Number(e.target.value))}>{[1,2,3].map(t => <option value={t} key={t}>Term {t}</option>)}</select></label>
          <label className={styles.field}>Week<input type="number" min={1} max={53} value={content.week_no} onChange={e => change("week_no", Number(e.target.value))}/></label>
          <label className={styles.field}>Number of sessions<select value={content.sessions.length} onChange={e => sessionCount(Number(e.target.value))}>{[1,2,3,4,5].map(n => <option value={n} key={n}>{n} session{n > 1 ? "s" : ""}</option>)}</select></label>
          <label className={styles.field}>Minutes per session<input type="number" min={10} max={240} value={content.duration_minutes} onChange={e => change("duration_minutes", Number(e.target.value))}/></label>
          <label className={`${styles.field} ${styles.wide}`}>Language of instruction<input value={content.language} maxLength={80} onChange={e => change("language", e.target.value)} placeholder="English, Filipino, or your classroom language"/></label>
          <label className={`${styles.field} ${styles.wide}`}>Learning competencies / BOW alignment<textarea value={content.competencies} maxLength={12000} rows={4} onChange={e => change("competencies", e.target.value)} placeholder="Paste the relevant competencies. Include their codes only when supplied by your actual reference."/></label>
          <label className={`${styles.field} ${styles.wide}`}>Learner context and adaptations<textarea value={content.learner_context} maxLength={8000} rows={3} onChange={e => change("learner_context", e.target.value)} placeholder="Prior knowledge, learning needs, available equipment, and adaptations. Use group descriptions instead of private learner details."/></label>
          <label className={styles.field}>Materials<textarea value={content.materials} maxLength={5000} rows={3} onChange={e => change("materials", e.target.value)}/></label>
          <label className={styles.field}>References<textarea value={content.references} maxLength={8000} rows={3} onChange={e => change("references", e.target.value)} placeholder="Actual BOW, books, page numbers, or links you used."/></label>
        </div></section>
        <section className={`${styles.card} ${styles.editor}`}><div className={styles.cardHead}><div><h2>Shape the learning experience</h2><p>Write the content you will teach. The generator organizes your work into the four ILAW parts.</p></div></div><div className={styles.sessionTabs}>{content.sessions.map((_, i) => <button type="button" key={i} className={`${styles.tab} ${activeSession === i ? styles.activeTab : ""}`} onClick={() => setActiveSession(i)}>Session {i + 1}</button>)}{activeSession > 0 && <button type="button" className={styles.quiet} onClick={() => { if (window.confirm("Replace this session’s content with a copy of the previous session?")) change("sessions", content.sessions.map((s,i) => i === activeSession ? { ...content.sessions[i - 1] } : s)); }}><Copy size={14}/>Copy previous</button>}</div>
          {ILAW_SECTIONS.map(part => <div className={styles.sectionField} key={part.key}><div className={styles.sectionLabel}><span>{part.letter}</span><div><strong>{part.title}</strong><small>{part.hint}</small></div></div><label className={styles.field}><span className="sr-only">Session {activeSession + 1}: {part.title}</span><textarea rows={part.key === "learning_experiences" ? 8 : 4} value={current[part.key]} maxLength={part.key === "learning_experiences" ? 20000 : part.key === "ways_forward" ? 10000 : 12000} onChange={e => changeSession(part.key, e.target.value)}/></label></div>)}
          <div className={styles.divider}/><label className={styles.check}><input type="checkbox" checked={reviewed} onChange={e => setReviewed(e.target.checked)}/><span>I have reviewed the competencies, lesson content, activities, and assessment for my learners. Reflections will be completed using actual classroom observations.</span></label><div className={styles.formActions}>{saved && <button className={styles.quiet} onClick={() => void save("archived")} disabled={!!working}><Archive size={15}/>Archive</button>}<button className={styles.secondary} onClick={() => void save("draft")} disabled={!!working}><Save size={15}/>{working === "save" ? "Saving…" : "Save draft"}</button><button className={styles.button} onClick={() => void save("ready")} disabled={!!working || !reviewed}><CheckCircle2 size={16}/>Save reviewed plan</button></div>
        </section>
        <article className={`${styles.paper} ${preview ? "" : styles.hiddenPreview}`} id="ilaw-preview"><div className={styles.paperHeader}><img src="/school-logo.png" alt="ANHS school seal"/><small>Republic of the Philippines · Department of Education<br/>Region XI · Schools Division of Davao del Norte</small><strong>ASUNCION NATIONAL HIGH SCHOOL</strong><small>ILAW LESSON PLAN</small></div><h2>{content.title || "Lesson title"}</h2><span className={styles.badge}>{saved?.status === "ready" && !dirty ? "Teacher-reviewed plan" : "Draft for teacher completion and review"}</span><dl><div><dt>Teacher</dt><dd>{teacherName}</dd></div><div><dt>Learning area</dt><dd>{content.subject}</dd></div><div><dt>Grade and section</dt><dd>Grade {content.grade_level} {content.section}</dd></div><div><dt>Term and week</dt><dd>Term {content.term_no} · Week {content.week_no}</dd></div><div><dt>Date</dt><dd>{content.lesson_date || "To be scheduled"}</dd></div><div><dt>Sessions and language</dt><dd>{content.sessions.length} × {content.duration_minutes} minutes · {content.language}</dd></div></dl><h3>Learning competencies</h3><p>{content.competencies || "For teacher completion"}</p><h3>Learner context and adaptations</h3><p>{content.learner_context || "For teacher completion"}</p><h3>Materials</h3><p>{content.materials || "For teacher completion"}</p><h3>References</h3><p>{content.references || "For teacher completion"}</p>{content.sessions.map((s,i) => <section className={styles.paperSession} key={i}><h2>Session {i + 1}</h2>{ILAW_SECTIONS.map(p => <div key={p.key}><h3>{p.letter} · {p.title}</h3><p>{s[p.key] || (p.key === "ways_forward" ? "To be completed by the teacher after the lesson, as appropriate." : "For teacher completion")}</p></div>)}</section>)}</article>
      </fieldset>
    </div>
  </main>;
}
