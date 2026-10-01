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

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <nav className={styles.topActions}>
          <a href="/portal"><ArrowLeft size={16} />Back to portal</a>
          <button onClick={() => void loadStudents()} disabled={loading}>
            <RefreshCw size={16} />Refresh
          </button>
        </nav>

        <header className={styles.header}>
          <div>
            <span>REGISTRAR</span>
            <h1>SF10 Records</h1>
            <p>
              Build the learner permanent academic record from portal enrollment and published grade data.
              Print actions are recorded for accountability.
            </p>
          </div>
          <div className={styles.badge}><ShieldCheck size={18} />Restricted record access</div>
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
                    <span>LRN {item.lrn ?? "Not set"}</span>
                    <small>
                      Grade {item.grade_level ?? "—"} · {item.section ?? "No section"} ·{" "}
                      {item.sf10_profile_complete ? "Profile ready" : "Needs SF10 info"}
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
                <strong>Select a learner</strong>
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
                    <Printer size={16} />Print record
                  </button>
                </section>

                <section className={styles.editor}>
                  <div className={styles.sectionHeading}>
                    <h2>Learner permanent-record information</h2>
                    <p>Complete the official identity and JHS eligibility fields once; grades are pulled automatically from the portal.</p>
                  </div>
                  <form onSubmit={saveProfile} className={styles.form}>
                    <label><span>Last name</span><input name="last_name" defaultValue={record.last_name ?? ""} required /></label>
                    <label><span>First name</span><input name="first_name" defaultValue={record.first_name ?? ""} required /></label>
                    <label><span>Middle name</span><input name="middle_name" defaultValue={record.middle_name ?? ""} /></label>
                    <label><span>Name extension</span><input name="name_extension" defaultValue={record.name_extension ?? ""} placeholder="Jr., II, III" /></label>
                    <label><span>Birthdate</span><input name="birth_date" type="date" defaultValue={record.birth_date ?? ""} required /></label>
                    <label>
                      <span>Sex</span>
                      <select name="sex" defaultValue={record.sex ?? ""} required>
                        <option value="">Select</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                      </select>
                    </label>
                    <label><span>Elementary school</span><input name="elementary_school_name" defaultValue={record.elementary_school_name ?? ""} /></label>
                    <label><span>Elementary school ID</span><input name="elementary_school_id" defaultValue={record.elementary_school_id ?? ""} /></label>
                    <label className={styles.wide}><span>Elementary school address</span><input name="elementary_school_address" defaultValue={record.elementary_school_address ?? ""} /></label>
                    <label><span>Elementary general average</span><input name="elementary_general_average" type="number" min="0" max="100" step="0.01" defaultValue={record.elementary_general_average ?? ""} /></label>
                    <label><span>Citation, if any</span><input name="elementary_citation" defaultValue={record.elementary_citation ?? ""} /></label>
                    <button className={styles.saveButton} type="submit" disabled={working === "save"}>
                      <Save size={16} />{working === "save" ? "Saving…" : "Save permanent record"}
                    </button>
                  </form>
                </section>

                <section className={styles.printSheet}>
                  <div className={styles.printNotice}>
                    Portal-generated SF10 data preview for the SY 2026–2027 three-term grading structure.
                    Verify the latest LIS-issued SF10 template before official release.
                  </div>

                  <div className={styles.printHeader}>
                    <span>Republic of the Philippines</span>
                    <strong>Department of Education</strong>
                    <h2>Learner Permanent Academic Record ({detail.formType === "JHS" ? "SF10-JHS" : "SF10-SHS"})</h2>
                  </div>

                  <div className={styles.identityGrid}>
                    <div><span>Last Name</span><strong>{record.last_name || "—"}</strong></div>
                    <div><span>First Name</span><strong>{record.first_name || "—"}</strong></div>
                    <div><span>Name Ext.</span><strong>{record.name_extension || "—"}</strong></div>
                    <div><span>Middle Name</span><strong>{record.middle_name || "—"}</strong></div>
                    <div><span>LRN</span><strong>{student?.lrn || "—"}</strong></div>
                    <div><span>Birthdate</span><strong>{record.birth_date || "—"}</strong></div>
                    <div><span>Sex</span><strong>{record.sex || "—"}</strong></div>
                  </div>

                  {records.map((year: any) => (
                    <section className={styles.yearRecord} key={`${year.school_year}-${year.grade_level}`}>
                      <div className={styles.yearMeta}>
                        <strong>{school.school_name || "Asuncion National High School"}</strong>
                        <span>School ID: {school.school_id || "________"} · District: {school.district || "________"} · Division: {school.division || "Davao del Norte"} · Region: {school.region || "Region XI"}</span>
                        <span>Grade {year.grade_level} · Section {year.section || "—"} · School Year {year.school_year} · Adviser: {year.adviser_name || "—"}</span>
                      </div>
                      <div className={styles.tableWrap}>
                        <table>
                          <thead>
                            <tr>
                              <th>Learning Area</th>
                              <th>Term 1</th>
                              <th>Term 2</th>
                              <th>Term 3</th>
                              <th>Final Rating</th>
                              <th>Remarks</th>
                            </tr>
                          </thead>
                          <tbody>
                            {year.subjects.map((subject: any) => (
                              <tr key={subject.assignment_id}>
                                <td>{subject.subject}</td>
                                <td>{subject.terms[0] ?? "—"}</td>
                                <td>{subject.terms[1] ?? "—"}</td>
                                <td>{subject.terms[2] ?? "—"}</td>
                                <td>{subject.final_rating ?? "—"}</td>
                                <td>{subject.remarks}</td>
                              </tr>
                            ))}
                            <tr className={styles.average}>
                              <td colSpan={4}>General Average</td>
                              <td>{year.general_average ?? "—"}</td>
                              <td>{year.general_average === null ? "Incomplete" : year.general_average >= 75 ? "Passed" : "Failed"}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </section>
                  ))}

                  <div className={styles.certification}>
                    <strong>CERTIFICATION</strong>
                    <p>
                      This portal record was generated from the learner profile, enrollment history, and published grades stored in the Asuncion NHS Academic Portal.
                    </p>
                    <div>
                      <span>Date: ____________________</span>
                      <span>School Head: {school.school_head_name || "____________________"}</span>
                    </div>
                  </div>
                </section>
              </>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
