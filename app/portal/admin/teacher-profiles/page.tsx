"use client";

import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import {
  ArrowLeft,
  BookOpenCheck,
  BriefcaseBusiness,
  GraduationCap,
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

const nameFields = [
  ["last_name", "Last Name"],
  ["first_name", "First Name"],
  ["middle_name", "Middle Name"],
  ["name_extension", "Name Extension"],
] as const;

const graduateFields = [
  [
    "graduate_units",
    "Indicate if graduated or units earned if not graduated or CAR for completed Academic Requirements",
  ],
  ["graduate_course", "Degree"],
] as const;

const tertiaryFields = [
  ["bachelors_degree", "Course"],
  ["major", "Major"],
  ["minor", "Minor"],
] as const;

const earningUnitsFields = [
  ["education_units_major", "Major"],
  ["education_units_minor", "Minor"],
] as const;

const otherProfileFields = [
  ["skills", "SKILLS / SPECIALIZATION (NC I, NC II, NC III / TRAINERS METHODOLOGY)"],
  ["philsys_number", "Philsys (National ID) Number"],
  ["religion", "Religion"],
  ["ethnic_group", "Ethnic Group"],
] as const;

const otherOfficialFields = [
  ["employment_status", "Employment Status"],
  ["employee_number", "Employee Number"],
  ["employment_end_date", "Employment End Date"],
  ["salary_grade", "Salary Grade / Step"],
  ["monthly_salary", "Monthly Salary (PHP)"],
  ["hr_notes", "HR Notes"],
] as const;

const serviceFields = [
  ["date_from", "From"], ["date_to", "To"], ["designation", "Designation"],
  ["status", "Appointment Status"], ["salary", "Annual Salary (PHP)"], ["station", "Office / Station"],
  ["branch", "Government Branch"], ["leave_without_pay", "Leave Without Pay"], ["remarks", "Remarks"],
] as const;

const ratingFields = [
  ["period", "Rating Period / School Year"], ["instrument", "Rating Instrument"],
  ["rating", "Final Rating"], ["description", "Adjectival Rating"], ["rater", "Rater"],
  ["date", "Date"], ["remarks", "Remarks"],
] as const;

const emptyRecord = (): RecordData => ({
  teacher_id: "", personal: {}, official: {}, service_records: [], ratings: [], version: 0,
});

function sourceAppointmentDate(official: Details) {
  const verified = String(official.appointment_date ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(verified)) return verified;

  const year = Number(String(official.appointment_year_source ?? "").trim());
  const raw = String(official.appointment_day_month_source ?? "").trim();
  if (!Number.isInteger(year) || year < 1900 || year > 2200 || !raw) return "";

  const numeric = Number(raw);
  let month = 0;
  let day = 0;

  if (Number.isFinite(numeric) && numeric > 1000) {
    const date = new Date(Date.UTC(1899, 11, 30));
    date.setUTCDate(date.getUTCDate() + Math.trunc(numeric));
    month = date.getUTCMonth() + 1;
    day = date.getUTCDate();
  } else {
    const parsed = new Date(raw);
    const fallback = Number.isNaN(parsed.getTime()) ? new Date(`${raw} ${year}`) : parsed;
    if (!Number.isNaN(fallback.getTime())) {
      month = fallback.getMonth() + 1;
      day = fallback.getDate();
    }
  }

  if (!month || !day) return "";
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

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
        const nextOfficial = {
          ...(next.official ?? {}),
          appointment_date:
            next.official?.appointment_date || sourceAppointmentDate(next.official ?? {}),
        };
        setRecord(next);
        setPersonal(next.personal ?? {});
        setOfficial(nextOfficial);
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

  function personalField(
    key: string,
    label: string,
    wide = false,
    multiline = false
  ) {
    return (
      <label className={wide ? styles.wide : ""} key={key}>
        <span>{label}</span>
        {multiline ? (
          <textarea
            rows={3}
            value={personal[key] ?? ""}
            onChange={(event) =>
              setPersonal((current) => ({ ...current, [key]: event.target.value }))
            }
          />
        ) : (
          <input
            value={personal[key] ?? ""}
            onChange={(event) =>
              setPersonal((current) => ({ ...current, [key]: event.target.value }))
            }
          />
        )}
      </label>
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
              Maintain the Teacher&apos;s Profile using the same labels as the official school
              personnel sheet, together with service history and performance ratings.
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
                    <span>TEACHER&apos;S PROFILE</span>
                    <h2>{teacher?.full_name}</h2>
                    <p>Asuncion National High School personnel record</p>
                  </div>
                </div>

                <section className={styles.panel}>
                  <div className={styles.panelHead}><BriefcaseBusiness size={20} /><h3>Employment Information</h3></div>
                  <div className={styles.grid}>
                    <label>
                      <span>Position</span>
                      <input value={teacher?.position || ""} readOnly />
                    </label>
                    <label>
                      <span>Date of Original Appointment</span>
                      <input
                        type="date"
                        value={official.appointment_date ?? ""}
                        onChange={(event) =>
                          setOfficial((current) => ({
                            ...current,
                            appointment_date: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <label className={styles.wide}>
                      <span>DepEd Email</span>
                      <input value={teacher?.email || ""} readOnly />
                    </label>
                  </div>
                </section>

                <section className={styles.panel}>
                  <div className={styles.panelHead}><UserRound size={20} /><h3>Name</h3></div>
                  <div className={styles.grid}>
                    {nameFields.map(([key, label]) => personalField(key, label))}
                  </div>
                </section>

                <section className={styles.panel}>
                  <div className={styles.panelHead}><GraduationCap size={20} /><h3>Graduate Studies</h3></div>
                  <div className={styles.grid}>
                    {graduateFields.map(([key, label]) =>
                      personalField(key, label, key === "graduate_units")
                    )}
                  </div>
                </section>

                <section className={styles.panel}>
                  <div className={styles.panelHead}><GraduationCap size={20} /><h3>Tertiary (Bachelor&apos;s Degree)</h3></div>
                  <div className={styles.grid}>
                    {tertiaryFields.map(([key, label]) => personalField(key, label))}
                  </div>
                </section>

                <section className={styles.panel}>
                  <div className={styles.panelHead}><GraduationCap size={20} /><h3>BSED-Earning Units</h3></div>
                  <div className={styles.grid}>
                    {earningUnitsFields.map(([key, label]) => personalField(key, label))}
                  </div>
                </section>

                <section className={styles.panel}>
                  <div className={styles.panelHead}><BookOpenCheck size={20} /><h3>Other Profile Information</h3></div>
                  <div className={styles.grid}>
                    {otherProfileFields.map(([key, label]) =>
                      personalField(key, label, key === "skills", key === "skills")
                    )}
                  </div>
                </section>

                <section className={styles.panel}>
                  <div className={styles.panelHead}><ShieldCheck size={20} /><h3>Additional HR Information</h3></div>
                  <div className={styles.grid}>
                    {otherOfficialFields.map(([key, label]) => (
                      <label className={key === "hr_notes" ? styles.wide : ""} key={key}>
                        <span>{label}</span>
                        {key === "hr_notes" ? (
                          <textarea
                            rows={3}
                            value={official[key] ?? ""}
                            onChange={(event) =>
                              setOfficial((current) => ({ ...current, [key]: event.target.value }))
                            }
                          />
                        ) : (
                          <input
                            type={key === "employment_end_date" ? "date" : "text"}
                            value={official[key] ?? ""}
                            onChange={(event) =>
                              setOfficial((current) => ({ ...current, [key]: event.target.value }))
                            }
                          />
                        )}
                      </label>
                    ))}
                  </div>
                </section>

                <section className={styles.panel}>
                  <div className={styles.panelTitleRow}>
                    <div className={styles.panelHead}><BriefcaseBusiness size={20} /><h3>Service Records</h3></div>
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
                    <div className={styles.panelHead}><BookOpenCheck size={20} /><h3>Performance Ratings</h3></div>
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
                    <span>Date of Original Appointment is stored as one uniform calendar date.</span>
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
