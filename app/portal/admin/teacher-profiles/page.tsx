"use client";

import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import {
  ArrowLeft,
  BookOpenCheck,
  BriefcaseBusiness,
  Plus,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  Trash2,
  UserRound,
} from "lucide-react";
import styles from "./teacher-profiles.module.css";

type Details = Record<string, string>;
type Teacher = {
  id: string;
  full_name: string;
  email: string;
  position: string | null;
  account_status: string;
  role?: string | null;
  requested_role?: string | null;
};
type RecordData = {
  teacher_id: string;
  personal: Details;
  official: Details;
  service_records: Details[];
  ratings: Details[];
  source_data?: Record<string, unknown>;
  version: number;
};

const personalFields = [
  ["last_name", "Last name"], ["first_name", "First name"], ["middle_name", "Middle name"],
  ["name_extension", "Name extension"], ["birth_date", "Birth date"], ["birth_place", "Place of birth"],
  ["mobile", "Mobile number"], ["address", "Home address"],
  ["bachelors_degree", "Bachelor's degree / course"], ["major", "Major"], ["minor", "Minor"],
  ["graduate_course", "Graduate course / master's degree"], ["graduate_units", "Graduate units / CAR"],
  ["additional_units", "Additional units / CAR"], ["education_units_major", "Education units / major"],
  ["education_units_minor", "Education units / minor"], ["skills", "Skills / specialization / NC"],
  ["philsys_number", "PhilSys number"], ["religion", "Religion"], ["ethnic_group", "Ethnic group"],
] as const;

const officialFields = [
  ["appointment_day_month_source", "Appointment day / month from source"],
  ["appointment_year_source", "Appointment year from source"],
  ["appointment_date", "Verified original appointment date"],
  ["employment_status", "Employment status"],
  ["employee_number", "Employee number"],
  ["employment_end_date", "Employment end date"],
  ["salary_grade", "Salary grade / step"],
  ["monthly_salary", "Monthly salary (PHP)"],
  ["hr_notes", "HR notes"],
] as const;

const serviceFields = [
  ["date_from", "From"], ["date_to", "To"], ["designation", "Designation"],
  ["status", "Appointment status"], ["salary", "Annual salary (PHP)"], ["station", "Office / station"],
  ["branch", "Government branch"], ["leave_without_pay", "Leave without pay"], ["remarks", "Remarks"],
] as const;

const ratingFields = [
  ["period", "Rating period / school year"], ["instrument", "Rating instrument"],
  ["rating", "Final rating"], ["description", "Adjectival rating"], ["rater", "Rater"],
  ["date", "Date"], ["remarks", "Remarks"],
] as const;

const emptyRecord = (): RecordData => ({
  teacher_id: "", personal: {}, official: {}, service_records: [], ratings: [], version: 0,
});

export default function TeacherProfilesHrPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [record, setRecord] = useState<RecordData>(emptyRecord());
  const [personal, setPersonal] = useState<Details>({});
  const [official, setOfficial] = useState<Details>({});
  const [service, setService] = useState<Details[]>([]);
  const [ratings, setRatings] = useState<Details[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingRecord, setLoadingRecord] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadTeachers() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/teacher-profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list" }),
        cache: "no-store",
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? "Unable to load Teacher profiles.");
      const loaded = (result.teachers ?? []) as Teacher[];
      setTeachers(loaded);
      if (!selectedId && loaded[0]?.id) setSelectedId(loaded[0].id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load Teacher profiles.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadTeachers();
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    let active = true;
    async function loadRecord() {
      setLoadingRecord(true);
      setError("");
      setMessage("");
      try {
        const response = await fetch("/api/teacher-profiles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "get", teacher_id: selectedId }),
          cache: "no-store",
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error ?? "Unable to load the Teacher record.");
        if (!active) return;
        setTeacher(result.teacher ?? null);
        const next = (result.record ?? emptyRecord()) as RecordData;
        setRecord(next);
        setPersonal(next.personal ?? {});
        setOfficial(next.official ?? {});
        setService(next.service_records ?? []);
        setRatings(next.ratings ?? []);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Unable to load the Teacher record.");
      } finally {
        if (active) setLoadingRecord(false);
      }
    }
    void loadRecord();
    return () => { active = false; };
  }, [selectedId]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return teachers;
    return teachers.filter((item) =>
      [item.full_name, item.email, item.position ?? ""].some((value) =>
        value.toLowerCase().includes(needle)
      )
    );
  }, [teachers, query]);

  function setEntry(
    setter: Dispatch<SetStateAction<Details[]>>,
    index: number,
    key: string,
    value: string
  ) {
    setter((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [key]: value } : item
      )
    );
  }

  async function saveRecord() {
    if (!selectedId) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/teacher-profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save",
          teacher_id: selectedId,
          version: record.version,
          personal,
          official,
          service_records: service,
          ratings,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? "Unable to save the Teacher record.");
      const next = result.record as RecordData;
      setRecord(next);
      setPersonal(next.personal ?? {});
      setOfficial(next.official ?? {});
      setService(next.service_records ?? []);
      setRatings(next.ratings ?? []);
      setMessage("HR Teacher record saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save the Teacher record.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <nav className={styles.topbar}>
          <a href="/portal"><ArrowLeft size={16} />Back to portal</a>
          <a href="/portal/admin/teacher-import"><UserRound size={16} />Teacher profile import</a>
        </nav>

        <header className={styles.header}>
          <div>
            <span>HUMAN RESOURCES</span>
            <h1>Teacher Profiles</h1>
            <p>
              Maintain personal information, verified employment details, service history, and
              performance ratings. Every saved change is versioned and recorded.
            </p>
          </div>
          <div className={styles.security}><ShieldCheck size={20} />HR-managed records</div>
        </header>

        {error && <div className={styles.error}>{error}</div>}
        {message && <div className={styles.success}>{message}</div>}

        <div className={styles.layout}>
          <aside className={styles.directory}>
            <div className={styles.directoryHead}>
              <div>
                <strong>Personnel</strong>
                <span>{teachers.length} profile account(s)</span>
              </div>
              <button onClick={() => void loadTeachers()} disabled={loading} aria-label="Refresh">
                <RefreshCw size={16} />
              </button>
            </div>
            <label className={styles.search}>
              <Search size={16} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search Teacher…" />
            </label>
            <div className={styles.list}>
              {filtered.map((item) => (
                <button
                  key={item.id}
                  className={selectedId === item.id ? styles.selected : ""}
                  onClick={() => setSelectedId(item.id)}
                >
                  <strong>{item.full_name}</strong>
                  <span>{item.position || "Teacher"}</span>
                  <small>{item.email}</small>
                </button>
              ))}
              {!loading && filtered.length === 0 && <p>No matching Teacher profile.</p>}
            </div>
          </aside>

          <section className={styles.editor}>
            {!selectedId ? (
              <div className={styles.empty}>Select a Teacher profile.</div>
            ) : loadingRecord ? (
              <div className={styles.empty}>Loading Teacher record…</div>
            ) : (
              <>
                <div className={styles.identity}>
                  <div className={styles.avatar}><UserRound size={26} /></div>
                  <div>
                    <span>PERSONNEL RECORD</span>
                    <h2>{teacher?.full_name}</h2>
                    <p>{teacher?.position || "Teacher"} · {teacher?.email}</p>
                  </div>
                </div>

                <section className={styles.panel}>
                  <div className={styles.panelHead}><UserRound size={20} /><h3>Personal and educational profile</h3></div>
                  <div className={styles.grid}>
                    {personalFields.map(([key, label]) => (
                      <label className={key === "address" || key === "skills" ? styles.wide : ""} key={key}>
                        <span>{label}</span>
                        {key === "address" || key === "skills" ? (
                          <textarea rows={3} value={personal[key] ?? ""} onChange={(event) => setPersonal((current) => ({ ...current, [key]: event.target.value }))} />
                        ) : (
                          <input type={key === "birth_date" ? "date" : "text"} value={personal[key] ?? ""} onChange={(event) => setPersonal((current) => ({ ...current, [key]: event.target.value }))} />
                        )}
                      </label>
                    ))}
                  </div>
                </section>

                <section className={styles.panel}>
                  <div className={styles.panelHead}><BriefcaseBusiness size={20} /><h3>Official employment information</h3></div>
                  <div className={styles.grid}>
                    {officialFields.map(([key, label]) => (
                      <label className={key === "hr_notes" ? styles.wide : ""} key={key}>
                        <span>{label}</span>
                        {key === "hr_notes" ? (
                          <textarea rows={3} value={official[key] ?? ""} onChange={(event) => setOfficial((current) => ({ ...current, [key]: event.target.value }))} />
                        ) : (
                          <input
                            type={key === "appointment_date" || key === "employment_end_date" ? "date" : "text"}
                            value={official[key] ?? ""}
                            onChange={(event) => setOfficial((current) => ({ ...current, [key]: event.target.value }))}
                          />
                        )}
                      </label>
                    ))}
                  </div>
                </section>

                <section className={styles.panel}>
                  <div className={styles.panelTitleRow}>
                    <div className={styles.panelHead}><BriefcaseBusiness size={20} /><h3>Service records</h3></div>
                    <button className={styles.add} onClick={() => setService((current) => [...current, {}])}><Plus size={15} />Add service record</button>
                  </div>
                  {service.length === 0 ? (
                    <p className={styles.empty}>No service history encoded yet.</p>
                  ) : service.map((item, index) => (
                    <div className={styles.entry} key={index}>
                      <div className={styles.entryTop}>
                        <strong>Service record {index + 1}</strong>
                        <button onClick={() => setService((current) => current.filter((_, i) => i !== index))}><Trash2 size={15} />Remove</button>
                      </div>
                      <div className={styles.grid}>
                        {serviceFields.map(([key, label]) => (
                          <label key={key}>
                            <span>{label}</span>
                            <input
                              type={key === "date_from" || key === "date_to" ? "date" : "text"}
                              value={item[key] ?? ""}
                              onChange={(event) => setEntry(setService, index, key, event.target.value)}
                            />
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </section>

                <section className={styles.panel}>
                  <div className={styles.panelTitleRow}>
                    <div className={styles.panelHead}><BookOpenCheck size={20} /><h3>Performance ratings</h3></div>
                    <button className={styles.add} onClick={() => setRatings((current) => [...current, {}])}><Plus size={15} />Add rating</button>
                  </div>
                  {ratings.length === 0 ? (
                    <p className={styles.empty}>No performance ratings encoded yet.</p>
                  ) : ratings.map((item, index) => (
                    <div className={styles.entry} key={index}>
                      <div className={styles.entryTop}>
                        <strong>Rating {index + 1}</strong>
                        <button onClick={() => setRatings((current) => current.filter((_, i) => i !== index))}><Trash2 size={15} />Remove</button>
                      </div>
                      <div className={styles.grid}>
                        {ratingFields.map(([key, label]) => (
                          <label key={key}>
                            <span>{label}</span>
                            <input
                              type={key === "date" ? "date" : "text"}
                              value={item[key] ?? ""}
                              onChange={(event) => setEntry(setRatings, index, key, event.target.value)}
                            />
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </section>

                <div className={styles.saveBar}>
                  <div>
                    <strong>HR record version {record.version}</strong>
                    <span>Saving creates the next auditable profile version.</span>
                  </div>
                  <button onClick={() => void saveRecord()} disabled={saving}>
                    <Save size={16} />{saving ? "Saving…" : "Save HR record"}
                  </button>
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
