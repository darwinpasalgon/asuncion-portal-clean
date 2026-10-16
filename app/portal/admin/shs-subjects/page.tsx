"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft, BookOpen, CheckCircle2, GraduationCap,
  Plus, RefreshCw, Trash2, Layers3,
} from "lucide-react";
import styles from "./shs-subjects.module.css";

type Subject = {
  id: string; grade_level: number; name: string;
  is_active: boolean; is_graded: boolean;
};
type Offering = {
  id: string; subject_id: string; grade_level: number;
  category: "core" | "elective"; program_code: string;
  term_no: number; group_label: string | null; units: number | null; is_active: boolean;
};
type SchoolYear = { id: string; name: string };
const PROGRAMS = [
  { code: "STEM_MEDICAL", label: "STEM · Medical", full: "Science, Technology, Engineering and Mathematics · Medical", type: "Academic" },
  { code: "STEM_ENGINEERING", label: "STEM · Engineering", full: "Science, Technology, Engineering and Mathematics · Engineering", type: "Academic" },
  { code: "BUSINESS_ENTREPRENEURSHIP", label: "Business and Entrepreneurship", full: "Business and Entrepreneurship", type: "Academic" },
  { code: "ASSH", label: "Arts, Social Sciences, and Humanities", full: "Arts, Social Sciences, and Humanities", type: "Academic" },
  { code: "TVL_OAP", label: "Organic Agriculture Production", full: "Organic Agriculture Production", type: "TVL" },
  { code: "TVL_FOOD_PROCESSING", label: "Food Processing", full: "Food Processing", type: "TVL" },
] as const;

export default function ShsSubjectManagerPage() {
  const [year, setYear] = useState<SchoolYear | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [offerings, setOfferings] = useState<Offering[]>([]);
  const [grade, setGrade] = useState<11 | 12>(11);
  const [term, setTerm] = useState(1);
  const [program, setProgram] = useState<string>("STEM_MEDICAL");
  const [category, setCategory] = useState<"core" | "elective">("elective");
  const [existingSubjectId, setExistingSubjectId] = useState("");
  const [newName, setNewName] = useState("");
  const [groupLabel, setGroupLabel] = useState("");
  const [newUnits, setNewUnits] = useState("");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/shs-subjects", { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Unable to load SHS subjects.");
      setYear(data.year ?? null);
      setSubjects(data.subjects ?? []);
      setOfferings(data.offerings ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load SHS subjects.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const subjectMap = useMemo(
    () => new Map(subjects.map((subject) => [subject.id, subject])),
    [subjects]
  );
  const activeOfferings = useMemo(
    () => offerings.filter((o) => o.grade_level === grade && o.is_active && subjectMap.get(o.subject_id)?.is_active),
    [offerings, grade, subjectMap]
  );
  const core = activeOfferings.filter((o) => o.category === "core")
    .sort((a, b) => (subjectMap.get(a.subject_id)?.name ?? "").localeCompare(subjectMap.get(b.subject_id)?.name ?? ""));
  const electives = activeOfferings.filter((o) =>
    o.category === "elective" && o.program_code === program && o.term_no === term
  ).sort((a, b) => (subjectMap.get(a.subject_id)?.name ?? "").localeCompare(subjectMap.get(b.subject_id)?.name ?? ""));
  const communication = core.filter((o) => o.group_label === "Effective Communication / Mabisang Komunikasyon");
  const remainingCore = core.filter((o) => !communication.includes(o));
  const availableSubjects = subjects.filter((subject) =>
    subject.grade_level === grade && subject.is_graded
  ).sort((a, b) => a.name.localeCompare(b.name));

  async function mutate(body: Record<string, unknown>) {
    setWorking(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/admin/shs-subjects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Unable to update subject setup.");
      setMessage(data.message ?? "Changes saved.");
      setExistingSubjectId("");
      setNewName("");
      setGroupLabel("");
      setNewUnits("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to update subject setup.");
    } finally {
      setWorking(false);
    }
  }

  const subjectRow = (offering: Offering) => (
    <div className={styles.subjectRow} key={offering.id}>
      <div>
        <strong>{subjectMap.get(offering.subject_id)?.name ?? "Subject"}</strong>
        {offering.group_label && <small>{offering.group_label}</small>}
        <small>Units: {offering.units === null || offering.units === undefined ? "Not set" : offering.units}</small>
      </div>
      <div className={styles.unitActions}>
        <button type="button" className={styles.unitButton} disabled={working}
          onClick={() => {
            const value = window.prompt(
              "Enter credit units for " + (subjectMap.get(offering.subject_id)?.name ?? "subject") +
              " (leave blank when unknown):",
              offering.units === null || offering.units === undefined ? "" : String(offering.units)
            );
            if (value === null) return;
            const trimmed = value.trim();
            if (trimmed !== "" && (!Number.isFinite(Number(trimmed)) || Number(trimmed) < 0 ||
              Number(trimmed) > 20 || Math.round(Number(trimmed) * 10) !== Number(trimmed) * 10)) {              setError("Enter valid credit units between 0 and 20, with one decimal place.");
              return;
            }
            void mutate({ action: "set_units", id: offering.id, units: trimmed });
          }}
        >Set Units</button>
      <button
        type="button"
        className={styles.remove}
        disabled={working}
        aria-label={"Remove " + (subjectMap.get(offering.subject_id)?.name ?? "subject") + " from offering"}
        onClick={() => {
          if (!window.confirm("Remove this subject from the selected SHS offering? Existing grades and teacher assignments will be kept.")) return;
          void mutate({ action: "remove_offering", id: offering.id });
        }}
      ><Trash2 size={15} /> Remove</button>
      </div>
    </div>
  );

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <nav className={styles.topBar}>
          <a href="/portal/admin/teaching"><ArrowLeft size={17} /> Teaching Subject Management</a>
          <a href="/portal/admin/school-setup">Assign Grade 11 Section Programs</a>
          <button type="button" onClick={() => void load()} disabled={loading || working}>
            <RefreshCw size={16} /> Refresh
          </button>
        </nav>
        <header className={styles.header}>
          <div>
            <span className={styles.eyebrow}>SENIOR HIGH SCHOOL · SUBJECT SETUP</span>
            <h1>Core Subjects &amp; Term Electives</h1>
            <p>Organize Grade 11 and Grade 12 subjects by core requirements, Academic or TVL program, and school term.</p>
          </div>
          <div className={styles.year}><GraduationCap size={18} /> {year?.name ?? "No Active School Year"}</div>
        </header>

        {error && <div className={styles.error} role="alert">{error}</div>}
        {message && <div className={styles.success} role="status"><CheckCircle2 size={17} /> {message}</div>}

        <div className={styles.gradeTabs} aria-label="Grade level">
          <button type="button" className={grade === 11 ? styles.gradeActive : ""} onClick={() => { setGrade(11); setTerm(1); setExistingSubjectId(""); }}>Grade 11</button>
          <button type="button" className={grade === 12 ? styles.gradeActive : ""} onClick={() => { setGrade(12); setTerm(1); setExistingSubjectId(""); }}>Grade 12</button>
        </div>

        {loading ? <div className={styles.loading}><RefreshCw size={22} /> Loading SHS subject setup…</div> : !year ? (
          <div className={styles.empty}>Please configure an active school year before managing offerings.</div>
        ) : (
          <>
            <section className={styles.panel}>
              <div className={styles.panelTitle}>
                <div className={styles.sectionIcon}><BookOpen size={19} /></div>
                <div><h2>Core Subjects</h2><p>Shared core catalog for Grade {grade}. Assign language alternatives according to the actual class program.</p></div>
                <span className={styles.count}>{core.length} subjects</span>
              </div>
              {communication.length > 0 && (
                <div className={styles.communication}>
                  <strong>Effective Communication / Mabisang Komunikasyon</strong>
                  <span>Alternative language offerings. Choose the appropriate one when assigning the class, not both automatically.</span>
                  {communication.map(subjectRow)}
                </div>
              )}
              <div className={styles.subjectList}>
                {remainingCore.length ? remainingCore.map(subjectRow) :
                  communication.length === 0 && <div className={styles.empty}>No core subjects configured for Grade {grade}.</div>}
              </div>
              <p className={styles.panelFootnote}>HGP and ARAL remain separate, non-graded teaching loads and are not included in these core subjects.</p>
            </section>

            <section className={styles.panel}>
              <div className={styles.panelTitle}>
                <div className={styles.sectionIcon}><Layers3 size={19} /></div>
                <div><h2>Program Electives</h2><p>Assign electives to the chosen program and term. Each program has its own offering list.</p></div>
                <span className={styles.count}>{electives.length} electives</span>
              </div>
              <div className={styles.filters}>
                <label><span>Term</span>
                  <select value={term} onChange={(e) => setTerm(Number(e.target.value))}>
                    {Array.from({ length: grade === 11 ? 3 : 2 }, (_, i) => i + 1).map(n => <option value={n} key={n}>Term {n}</option>)}
                  </select>
                </label>
                <label><span>Track / Strand / Specialization</span>
                  <select value={program} onChange={(e) => setProgram(e.target.value)}>
                    <optgroup label="Academic">
                      {PROGRAMS.filter((p) => p.type === "Academic").map(p => <option value={p.code} key={p.code}>{p.label}</option>)}
                    </optgroup>
                    <optgroup label="Technical-Vocational-Livelihood (TVL)">
                      {PROGRAMS.filter((p) => p.type === "TVL").map(p => <option value={p.code} key={p.code}>{p.label}</option>)}
                    </optgroup>
                  </select>
                </label>
              </div>
              <div className={styles.selectedProgram}>
                <strong>{PROGRAMS.find((p) => p.code === program)?.full}</strong>
                <span>Grade {grade} · Term {term} · {PROGRAMS.find((p) => p.code === program)?.type}</span>
              </div>
              <div className={styles.subjectList}>
                {electives.length ? electives.map(subjectRow) :
                  <div className={styles.empty}>No electives added for this program and term yet. Use the form below to add one.</div>}
              </div>
            </section>

            <section className={styles.panel} id="add-shs-subject">
              <div className={styles.panelTitle}>
                <div className={styles.sectionIcon}><Plus size={19} /></div>
                <div><h2>Add SHS Subject</h2><p>Create a new subject or select an existing subject and include it in a core or elective offering.</p></div>
              </div>
              <form className={styles.form} onSubmit={(e) => {
                e.preventDefault();
                if (!existingSubjectId && !newName.trim()) { setError("Choose an existing subject or enter a new subject name."); return; }
                void mutate({
                  action: "add_offering", gradeLevel: grade, category,
                  programCode: category === "core" ? "ALL" : program,
                  termNo: category === "core" ? 0 : term,
                  subjectId: existingSubjectId || undefined,
                  name: existingSubjectId ? undefined : newName.trim(),
                  groupLabel: category === "core" ? groupLabel : null,
                  units: newUnits.trim(),
                });
              }}>
                <div className={styles.formRow}>
                  <label><span>Subject Type</span>
                    <select value={category} onChange={(e) => setCategory(e.target.value as "core" | "elective")}>
                      <option value="core">Core Subject</option>
                      <option value="elective">Program Elective</option>
                    </select>
                  </label>
                  <label><span>Existing Subject (Optional)</span>
                    <select value={existingSubjectId} onChange={(e) => { setExistingSubjectId(e.target.value); setNewName(""); }}>
                      <option value="">Create a new subject…</option>
                      {availableSubjects.map((subject) => <option value={subject.id} key={subject.id}>{subject.name}</option>)}
                    </select>
                  </label>
                </div>
                {!existingSubjectId && <label><span>New Subject Name</span>
                  <input value={newName} maxLength={100} onChange={(e) => setNewName(e.target.value)}
                    placeholder="Enter the official subject / elective name" />
                </label>}
                {category === "core" ? <label><span>Core Group (Optional)</span>
                  <select value={groupLabel} onChange={(e) => setGroupLabel(e.target.value)}>
                    <option value="">Standalone core subject</option>
                    <option value="Effective Communication / Mabisang Komunikasyon">Effective Communication / Mabisang Komunikasyon</option>
                  </select>
                </label> :
                  <p className={styles.target}>Will be offered in: <strong>Grade {grade} · Term {term} · {PROGRAMS.find((p) => p.code === program)?.label}</strong></p>}
                <label><span>Credit Units for SF9 (Optional)</span>
                  <input type="number" min="0" max="20" step="0.1" value={newUnits}
                    onChange={(event) => setNewUnits(event.target.value)}
                    placeholder="Leave blank until confirmed by the official template" />
                </label>
                <button className={styles.addButton} disabled={working} type="submit"><Plus size={17} /> {working ? "Saving Subject…" : "Add to Subject Setup"}</button>
              </form>
              <p className={styles.panelFootnote}>Removing an offering does not delete grades, schedules, or teacher assignments. Subject offerings are configured per active school year and do not automatically assign a teacher.</p>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
