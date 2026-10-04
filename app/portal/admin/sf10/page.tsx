"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  FileSpreadsheet,
  Printer,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
} from "lucide-react";
import styles from "./sf10.module.css";
import { JhsSf10Form, ShsSf10Form } from "./Sf10PrintForms";

type Student = {
  id: string;
  full_name: string;
  lrn: string | null;
  grade_level: number | null;
  section: string | null;
  sf10_profile_complete: boolean;
};

export default function Sf10Page() {
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [detail, setDetail] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function loadStudents() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/sf10", { cache: "no-store" });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(result.error ?? "Unable to load learner records.");
        return;
      }
      setStudents(result.students ?? []);
    } catch {
      setError("Unable to reach the SF10 service.");
    } finally {
      setLoading(false);
    }
  }

  async function loadStudent(studentId: string) {
    setSelectedId(studentId);
    setDetail(null);
    setError("");
    setSuccess("");
    if (!studentId) return;

    setWorking("load");
    try {
      const response = await fetch(
        `/api/admin/sf10?studentId=${encodeURIComponent(studentId)}`,
        { cache: "no-store" }
      );
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(result.error ?? "Unable to load the learner SF10 record.");
        return;
      }
      setDetail(result);
    } catch {
      setError("Unable to reach the SF10 service.");
    } finally {
      setWorking("");
    }
  }

  useEffect(() => {
    void loadStudents();
  }, []);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return students;
    return students.filter((student) =>
      [student.full_name, student.lrn ?? "", student.section ?? "", String(student.grade_level ?? "")]
        .some((value) => value.toLowerCase().includes(needle))
    );
  }, [students, search]);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedId) return;

    const form = event.currentTarget;
    const data = new FormData(form);
    const payload: Record<string, unknown> = {
      action: "save_profile",
      studentId: selectedId,
    };
    for (const [key, value] of data.entries()) payload[key] = String(value);

    setWorking("save");
    setError("");
    setSuccess("");
    try {
      const response = await fetch("/api/admin/sf10", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(result.error ?? "Unable to save the permanent-record information.");
        return;
      }
      setSuccess("Learner permanent-record information saved.");
      await loadStudent(selectedId);
      await loadStudents();
    } catch {
      setError("Unable to reach the SF10 service.");
    } finally {
      setWorking("");
    }
  }

  async function printRecord() {
    if (!selectedId || !detail) return;
    setWorking("print");
    setError("");
    try {
      const response = await fetch("/api/admin/sf10", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "log_print",
          studentId: selectedId,
          formType: detail.formType,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(result.error ?? "Unable to record the print action.");
        return;
      }
      window.print();
    } catch {
      setError("Unable to record the SF10 print action.");
    } finally {
      setWorking("");
    }
  }

  const record = detail?.permanentRecord ?? {};
  const school = detail?.schoolInformation ?? {};
  const student = detail?.student ?? null;
  const records = detail?.scholasticRecords ?? [];
  const profileComplete = Boolean(
    record.last_name && record.first_name && record.birth_date && record.sex
  );
  const schoolComplete = Boolean(
    school.school_name && school.school_id && school.district && school.division && school.region
  );
  const isShs = Number(student?.grade_level ?? 0) >= 11;

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <nav className={styles.topActions}>
          <a href="/portal"><ArrowLeft size={16} />Back to Portal</a>
          <button onClick={() => void loadStudents()} disabled={loading}>
            <RefreshCw size={16} />Refresh
          </button>
        </nav>

        <header className={styles.header}>
          <div>
            <span>REGISTRAR</span>
            <h1>SF10 Records</h1>
            <p>
              Learner identity fields are initialized from verified SF1 data. Historical eligibility,
              school history, and credentials must still come from official records. Published grades
              flow into the scholastic record automatically.
            </p>
          </div>
          <div className={styles.badge}><ShieldCheck size={18} />Restricted Record Access</div>
        </header>

        {error && <div className={styles.error}>{error}</div>}
        {success && <div className={styles.success}>{success}</div>}

        <div className={styles.layout}>
          <aside className={styles.learners}>
            <div className={styles.search}>
              <Search size={16} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search learner or LRN"
              />
            </div>

            <div className={styles.learnerList}>
              {loading ? (
                <div className={styles.empty}>Loading learners…</div>
              ) : filtered.length === 0 ? (
                <div className={styles.empty}>No learners found.</div>
              ) : (
                filtered.map((item) => (
                  <button
                    key={item.id}
                    className={selectedId === item.id ? styles.selectedLearner : styles.learner}
                    onClick={() => void loadStudent(item.id)}
                  >
                    <strong>{item.full_name}</strong>
                    <span>LRN {item.lrn ?? "Not Set"}</span>
                    <small>
                      Grade {item.grade_level ?? "—"} · {item.section ?? "No section"} ·{" "}
                      {item.sf10_profile_complete ? "Profile Ready" : "Needs SF10 Info"}
                    </small>
                  </button>
                ))
              )}
            </div>
          </aside>

          <section className={styles.workspace}>
            {!selectedId ? (
              <div className={styles.placeholder}>
                <FileSpreadsheet size={40} />
                <strong>Select a Learner</strong>
                <span>The learner’s permanent record and scholastic history will appear here.</span>
              </div>
            ) : working === "load" || !detail ? (
              <div className={styles.placeholder}>Loading SF10 record…</div>
            ) : (
              <>
                <section className={styles.statusBar}>
                  <div>
                    <span>FORM</span>
                    <strong>SF10-{detail.formType}</strong>
                  </div>
                  <div>
                    <span>LEARNER INFO</span>
                    <strong className={profileComplete ? styles.ready : styles.needs}>
                      {profileComplete ? "Ready" : "Incomplete"}
                    </strong>
                  </div>
                  <div>
                    <span>SCHOOL INFO</span>
                    <strong className={schoolComplete ? styles.ready : styles.needs}>
                      {schoolComplete ? "Ready" : "Needs School ID/District"}
                    </strong>
                  </div>
                  <button
                    className={styles.printButton}
                    disabled={working === "print" || !profileComplete}
                    onClick={() => void printRecord()}
                  >
                    <Printer size={16} />Print Record
                  </button>
                </section>

                <section className={styles.editor}>
                  <div className={styles.sectionHeading}>
                    <h2>Learner Permanent-Record Information</h2>
                    <p>
                      {isShs
                        ? "Identity fields were initialized from SF1. Review them, then complete only the JHS/SHS history and program fields supported by official records. Published grades are pulled automatically."
                        : "Identity fields were initialized from SF1. Review them, then complete only the JHS eligibility and historical fields supported by official records. Published grades are pulled automatically."}
                    </p>
                  </div>
                  <form onSubmit={saveProfile} className={styles.form}>
                    <label><span>Last Name</span><input name="last_name" defaultValue={record.last_name ?? ""} required /></label>
                    <label><span>First Name</span><input name="first_name" defaultValue={record.first_name ?? ""} required /></label>
                    <label><span>Middle Name</span><input name="middle_name" defaultValue={record.middle_name ?? ""} /></label>
                    <label><span>Name Extension</span><input name="name_extension" defaultValue={record.name_extension ?? ""} placeholder="Jr., II, III" /></label>
                    <label><span>Birthdate</span><input name="birth_date" type="date" defaultValue={record.birth_date ?? ""} required /></label>
                    <label>
                      <span>Sex</span>
                      <select name="sex" defaultValue={record.sex ?? ""} required>
                        <option value="">Select</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                      </select>
                    </label>
                    {!isShs ? (
                      <>
                        <label>
                          <span>JHS Eligibility</span>
                          <select name="eligibility_type" defaultValue={record.eligibility_type ?? ""}>
                            <option value="">Not Yet Recorded</option>
                            <option value="elementary_completer">Elementary School Completer</option>
                            <option value="pept">PEPT Passer</option>
                            <option value="a_and_e">ALS A&amp;E Passer</option>
                            <option value="other">Other Credential</option>
                          </select>
                        </label>
                        <label><span>Elementary School</span><input name="elementary_school_name" defaultValue={record.elementary_school_name ?? ""} /></label>
                        <label><span>Elementary School ID</span><input name="elementary_school_id" defaultValue={record.elementary_school_id ?? ""} /></label>
                        <label className={styles.wide}><span>Elementary School Address</span><input name="elementary_school_address" defaultValue={record.elementary_school_address ?? ""} /></label>
                        <label><span>Elementary General Average</span><input name="elementary_general_average" type="number" min="0" max="100" step="0.01" defaultValue={record.elementary_general_average ?? ""} /></label>
                        <label><span>Citation, If Any</span><input name="elementary_citation" defaultValue={record.elementary_citation ?? ""} /></label>
                        <label><span>Eligibility Rating</span><input name="eligibility_rating" defaultValue={record.eligibility_rating ?? ""} /></label>
                        <label><span>Other Credential</span><input name="eligibility_other" defaultValue={record.eligibility_other ?? ""} /></label>
                        <label><span>Assessment Date</span><input name="assessment_date" type="date" defaultValue={record.assessment_date ?? ""} /></label>
                        <label className={styles.wide}><span>Testing Center</span><input name="testing_center" defaultValue={record.testing_center ?? ""} /></label>
                      </>
                    ) : (
                      <>
                        <label><span>Date of SHS Admission</span><input name="shs_admission_date" type="date" defaultValue={record.shs_admission_date ?? ""} /></label>
                        <label><span>JHS Completion Date</span><input name="jhs_completion_date" type="date" defaultValue={record.jhs_completion_date ?? ""} /></label>
                        <label><span>JHS School</span><input name="jhs_school_name" defaultValue={record.jhs_school_name ?? ""} /></label>
                        <label><span>JHS School ID</span><input name="jhs_school_id" defaultValue={record.jhs_school_id ?? ""} /></label>
                        <label className={styles.wide}><span>JHS School Address</span><input name="jhs_school_address" defaultValue={record.jhs_school_address ?? ""} /></label>
                        <label><span>JHS General Average</span><input name="jhs_general_average" type="number" min="0" max="100" step="0.01" defaultValue={record.jhs_general_average ?? ""} /></label>
                        <label><span>SHS Track</span><input name="shs_track" defaultValue={record.shs_track ?? ""} placeholder="Academic / TVL / ALS" /></label>
                        <label className={styles.wide}><span>SHS Strand / Cluster / Specialization</span><input name="shs_strand" defaultValue={record.shs_strand ?? ""} placeholder="STEM, HUMSS, ABM, BE, ASSH, Food Processing, OAP..." /></label>
                        <label className={styles.wide}><span>Awards / Honors Received</span><input name="awards_honors" defaultValue={record.awards_honors ?? ""} /></label>
                        <label><span>SHS Graduation Date</span><input name="shs_graduation_date" type="date" defaultValue={record.shs_graduation_date ?? ""} /></label>
                        <label><span>SF10 Date Issued</span><input name="sf10_date_issued" type="date" defaultValue={record.sf10_date_issued ?? ""} /></label>
                      </>
                    )}
                    <button className={styles.saveButton} type="submit" disabled={working === "save"}>
                      <Save size={16} />{working === "save" ? "Saving…" : "Save Permanent Record"}
                    </button>
                  </form>
                </section>

                <section className={styles.printArea}>
                  <style>{`@media print { @page { size: ${detail.formType === "JHS" ? "8.5in 14in" : "8.5in 13in"}; margin: 0; } }`}</style>
                  {detail.formType === "JHS" ? (
                    <JhsSf10Form detail={detail} />
                  ) : Number(student?.grade_level ?? 0) === 11 ? (
                    <div className={styles.strengthenedNotice}>
                      <strong>Strengthened SHS SF10 v2026</strong>
                      <span>
                        Grade 11 uses the separate Strengthened SHS SF10 v2026 format.
                        The Grade 12 DepEd SF10 template is not substituted for this learner.
                      </span>
                    </div>
                  ) : (
                    <ShsSf10Form detail={detail} />
                  )}
                </section>
              </>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
