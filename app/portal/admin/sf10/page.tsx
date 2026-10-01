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

type Learner = {
  id: string;
  full_name: string;
  lrn: string | null;
  grade_level: number | null;
  section: string | null;
  sf10_profile_complete: boolean;
};

type PermanentRecord = {
  last_name?: string | null;
  first_name?: string | null;
  middle_name?: string | null;
  name_extension?: string | null;
  birth_date?: string | null;
  sex?: string | null;
  elementary_school_name?: string | null;
  elementary_school_id?: string | null;
  elementary_school_address?: string | null;
  elementary_general_average?: number | null;
  elementary_citation?: string | null;
};

type SchoolInformation = {
  school_name?: string | null;
  school_id?: string | null;
  district?: string | null;
  division?: string | null;
  region?: string | null;
  school_head_name?: string | null;
};

type SubjectRecord = {
  assignment_id: string;
  subject: string;
  terms: Array<number | null>;
  final_rating: number | null;
  remarks: string;
};

type ScholasticRecord = {
  school_year: string;
  grade_level: number;
  section: string;
  adviser_name: string;
  subjects: SubjectRecord[];
  general_average: number | null;
};

type Sf10Detail = {
  student: Learner;
  permanentRecord: PermanentRecord | null;
  schoolInformation: SchoolInformation | null;
  scholasticRecords: ScholasticRecord[];
  formType: "JHS" | "SHS";
};

export default function Sf10Page() {
  const [learners, setLearners] = useState<Learner[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [detail, setDetail] = useState<Sf10Detail | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function loadLearners() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/sf10", { cache: "no-store" });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(result.error ?? "Unable to load learner records.");
        return;
      }
      setLearners((result.students ?? []) as Learner[]);
    } catch {
      setError("Unable to reach the SF10 service.");
    } finally {
      setLoading(false);
    }
  }

  async function loadLearner(studentId: string) {
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
      setDetail(result as Sf10Detail);
    } catch {
      setError("Unable to reach the SF10 service.");
    } finally {
      setWorking("");
    }
  }

  useEffect(() => {
    void loadLearners();
  }, []);

  const filteredLearners = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return learners;
    return learners.filter((learner) =>
      [
        learner.full_name,
        learner.lrn ?? "",
        learner.section ?? "",
        String(learner.grade_level ?? ""),
      ].some((value) => value.toLowerCase().includes(needle))
    );
  }, [learners, search]);

  async function savePermanentRecord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedId) return;

    const data = new FormData(event.currentTarget);
    const body: Record<string, string> = {
      action: "save_profile",
      studentId: selectedId,
    };

    data.forEach((value, key) => {
      body[key] = String(value);
    });

    setWorking("save");
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/admin/sf10", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(result.error ?? "Unable to save the permanent record.");
        return;
      }

      setSuccess("Learner permanent-record information saved.");
      await loadLearner(selectedId);
      await loadLearners();
    } catch {
      setError("Unable to reach the SF10 service.");
    } finally {
      setWorking("");
    }
  }

  async function printSf10() {
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
        setError(result.error ?? "Unable to record the SF10 print action.");
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
  const records = detail?.scholasticRecords ?? [];
  const student = detail?.student ?? null;

  const identityReady = Boolean(
    record.last_name &&
      record.first_name &&
      record.birth_date &&
      record.sex
  );

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <nav className={styles.topActions}>
          <a href="/portal">
            <ArrowLeft size={16} />
            Back to portal
          </a>
          <button type="button" onClick={() => void loadLearners()} disabled={loading}>
            <RefreshCw size={16} />
            Refresh
          </button>
        </nav>

        <header className={styles.header}>
          <div>
            <span>REGISTRAR</span>
            <h1>SF10 Records</h1>
            <p>
              Prepare learner permanent academic records from verified learner
              information, enrollment history, and published grades.
            </p>
          </div>
          <div className={styles.badge}>
            <ShieldCheck size={18} />
            Restricted record access
          </div>
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
              ) : filteredLearners.length === 0 ? (
                <div className={styles.empty}>No learners found.</div>
              ) : (
                filteredLearners.map((learner) => (
                  <button
                    type="button"
                    key={learner.id}
                    className={
                      selectedId === learner.id
                        ? styles.selectedLearner
                        : styles.learner
                    }
                    onClick={() => void loadLearner(learner.id)}
                  >
                    <strong>{learner.full_name}</strong>
                    <span>LRN {learner.lrn ?? "Not set"}</span>
                    <small>
                      Grade {learner.grade_level ?? "—"} ·{" "}
                      {learner.section ?? "No section"} ·{" "}
                      {learner.sf10_profile_complete
                        ? "Profile ready"
                        : "Needs SF10 info"}
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
                <span>
                  The learner permanent record and scholastic history will appear here.
                </span>
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
                    <strong className={identityReady ? styles.ready : styles.needs}>
                      {identityReady ? "Ready" : "Incomplete"}
                    </strong>
                  </div>
                  <button
                    type="button"
                    className={styles.printButton}
                    disabled={working === "print" || !identityReady}
                    onClick={() => void printSf10()}
                  >
                    <Printer size={16} />
                    Print record
                  </button>
                </section>

                <section className={styles.editor}>
                  <div className={styles.sectionHeading}>
                    <h2>Learner permanent-record information</h2>
                    <p>
                      Complete the identity information once. Published grades are
                      pulled automatically from the portal.
                    </p>
                  </div>

                  <form className={styles.form} onSubmit={savePermanentRecord}>
                    <label>
                      <span>Last name</span>
                      <input
                        name="last_name"
                        defaultValue={record.last_name ?? ""}
                        required
                      />
                    </label>
                    <label>
                      <span>First name</span>
                      <input
                        name="first_name"
                        defaultValue={record.first_name ?? ""}
                        required
                      />
                    </label>
                    <label>
                      <span>Middle name</span>
                      <input
                        name="middle_name"
                        defaultValue={record.middle_name ?? ""}
                      />
                    </label>
                    <label>
                      <span>Name extension</span>
                      <input
                        name="name_extension"
                        defaultValue={record.name_extension ?? ""}
                        placeholder="Jr., II, III"
                      />
                    </label>
                    <label>
                      <span>Birthdate</span>
                      <input
                        name="birth_date"
                        type="date"
                        defaultValue={record.birth_date ?? ""}
                        required
                      />
                    </label>
                    <label>
                      <span>Sex</span>
                      <select name="sex" defaultValue={record.sex ?? ""} required>
                        <option value="">Select</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                      </select>
                    </label>
                    <label>
                      <span>Elementary school</span>
                      <input
                        name="elementary_school_name"
                        defaultValue={record.elementary_school_name ?? ""}
                      />
                    </label>
                    <label>
                      <span>Elementary school ID</span>
                      <input
                        name="elementary_school_id"
                        defaultValue={record.elementary_school_id ?? ""}
                      />
                    </label>
                    <label className={styles.wide}>
                      <span>Elementary school address</span>
                      <input
                        name="elementary_school_address"
                        defaultValue={record.elementary_school_address ?? ""}
                      />
                    </label>
                    <label>
                      <span>Elementary general average</span>
                      <input
                        name="elementary_general_average"
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        defaultValue={record.elementary_general_average ?? ""}
                      />
                    </label>
                    <label>
                      <span>Citation, if any</span>
                      <input
                        name="elementary_citation"
                        defaultValue={record.elementary_citation ?? ""}
                      />
                    </label>

                    <button
                      className={styles.saveButton}
                      type="submit"
                      disabled={working === "save"}
                    >
                      <Save size={16} />
                      {working === "save" ? "Saving…" : "Save permanent record"}
                    </button>
                  </form>
                </section>

                <section className={styles.printSheet}>
                  <div className={styles.printNotice}>
                    Portal-generated SF10 data preview for the SY 2026–2027
                    three-term grading structure. Verify the latest LIS-issued
                    SF10 template before official release.
                  </div>

                  <div className={styles.printHeader}>
                    <span>Republic of the Philippines</span>
                    <strong>Department of Education</strong>
                    <h2>
                      Learner Permanent Academic Record (
                      {detail.formType === "JHS" ? "SF10-JHS" : "SF10-SHS"})
                    </h2>
                  </div>

                  <div className={styles.identityGrid}>
                    <div>
                      <span>Last Name</span>
                      <strong>{record.last_name || "—"}</strong>
                    </div>
                    <div>
                      <span>First Name</span>
                      <strong>{record.first_name || "—"}</strong>
                    </div>
                    <div>
                      <span>Name Ext.</span>
                      <strong>{record.name_extension || "—"}</strong>
                    </div>
                    <div>
                      <span>Middle Name</span>
                      <strong>{record.middle_name || "—"}</strong>
                    </div>
                    <div>
                      <span>LRN</span>
                      <strong>{student?.lrn || "—"}</strong>
                    </div>
                    <div>
                      <span>Birthdate</span>
                      <strong>{record.birth_date || "—"}</strong>
                    </div>
                    <div>
                      <span>Sex</span>
                      <strong>{record.sex || "—"}</strong>
                    </div>
                  </div>

                  {records.length === 0 ? (
                    <div className={styles.empty}>
                      No published scholastic records are available yet.
                    </div>
                  ) : (
                    records.map((year) => (
                      <section
                        className={styles.yearRecord}
                        key={`${year.school_year}-${year.grade_level}-${year.section}`}
                      >
                        <div className={styles.yearMeta}>
                          <strong>
                            {school.school_name || "Asuncion National High School"}
                          </strong>
                          <span>
                            School ID: {school.school_id || "________"} · District:{" "}
                            {school.district || "________"} · Division:{" "}
                            {school.division || "Davao del Norte"} · Region:{" "}
                            {school.region || "Region XI"}
                          </span>
                          <span>
                            Grade {year.grade_level} · Section {year.section || "—"} ·
                            School Year {year.school_year} · Adviser:{" "}
                            {year.adviser_name || "—"}
                          </span>
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
                              {year.subjects.map((subject) => (
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
                                <td>
                                  {year.general_average === null
                                    ? "Incomplete"
                                    : year.general_average >= 75
                                      ? "Passed"
                                      : "Failed"}
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </section>
                    ))
                  )}

                  <div className={styles.certification}>
                    <strong>CERTIFICATION</strong>
                    <p>
                      This record was generated from learner information,
                      enrollment history, and published grades in the Asuncion NHS
                      Academic Portal.
                    </p>
                    <div>
                      <span>Date: ____________________</span>
                      <span>
                        School Head:{" "}
                        {school.school_head_name || "____________________"}
                      </span>
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
