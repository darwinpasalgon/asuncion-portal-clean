"use client";

import { useEffect, useState } from "react";
import {
  ArrowLeft,
  BookOpenCheck,
  BriefcaseBusiness,
  GraduationCap,
  Save,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import styles from "./teacher-profile.module.css";
import ActionWaitOverlay from "@/app/components/action-wait-overlay";

type Details = Record<string, string>;
type ServiceRecord = Details;
type Rating = Details;
type PersonnelType = "teaching" | "non_teaching";

type TeacherRecord = {
  teacher_id: string;
  personal: Details;
  official: Details;
  service_records: ServiceRecord[];
  ratings: Rating[];
  version: number;
};

type Teacher = {
  id: string;
  full_name: string;
  email: string;
  position: string | null;
};

function emptyRecord(): TeacherRecord {
  return {
    teacher_id: "",
    personal: {},
    official: {},
    service_records: [],
    ratings: [],
    version: 0,
  };
}

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

function formatPhilSysInput(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 16);
  return digits.match(/.{1,4}/g)?.join(" - ") ?? digits;
}

function requiredMissingFields(personal: Details) {
  const missing: string[] = [];
  if (!["GRADUATED", "ON GOING", "NONE"].includes(personal.graduate_status ?? "")) {
    missing.push("Graduate Studies");
  }
  if (!String(personal.bachelors_degree ?? "").trim()) {
    missing.push("Bachelor's Degree");
  }
  if (String(personal.philsys_number ?? "").replace(/\D/g, "").length !== 16) {
    missing.push("PhilSys (National ID) Number");
  }
  return missing;
}

function formatDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value || "Not yet recorded";
  return `${match[2]}/${match[3]}/${match[1]}`;
}

const nameFields = [
  ["last_name", "Last Name"],
  ["first_name", "First Name"],
  ["middle_name", "Middle Name"],
  ["name_extension", "Name Extension"],
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

const otherFields = [
  ["skills", "Skills / specialization (NC I, NC II, NC III / Trainers Methodology)"],
  ["philsys_number", "Philsys (National ID) Number"],
  ["religion", "Religion"],
  ["ethnic_group", "Ethnic Group"],
] as const;

export default function MyTeacherProfilePage() {
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [record, setRecord] = useState<TeacherRecord>(emptyRecord());
  const [personal, setPersonal] = useState<Details>({});
  const [personnelType, setPersonnelType] = useState<PersonnelType>("teaching");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadProfile() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/teacher-profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get" }),
        cache: "no-store",
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? "Unable to load your Personnel Profile.");
      setTeacher(result.teacher ?? null);
      setPersonnelType(result.personnel_type === "non_teaching" ? "non_teaching" : "teaching");
      setRecord(result.record ?? emptyRecord());
      setPersonal(result.record?.personal ?? {});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load your Personnel Profile.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadProfile();
  }, []);

  async function save() {
    const missing = requiredMissingFields(personal);
    if (missing.length) {
      setError(`Complete the required profile fields: ${missing.join(", ")}.`);
      setMessage("");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/teacher-profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save",
          version: record.version,
          personal,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? "Unable to save your Teacher Profile.");
      setRecord(result.record);
      setPersonal(result.record?.personal ?? {});
      setMessage(personnelType === "non_teaching" ? "Personnel Profile saved." : "Teacher Profile saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save your Personnel Profile.");
    } finally {
      setSaving(false);
    }
  }

  function field(
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
            value={personal[key] ?? ""}
            onChange={(event) =>
              setPersonal((current) => ({ ...current, [key]: event.target.value }))
            }
            rows={3}
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

  const appointmentDate = sourceAppointmentDate(record.official ?? {});
  const missingRequired = requiredMissingFields(personal);
  const graduateStatus = String(personal.graduate_status ?? "");

  if (loading) {
    return (
      <main className={styles.loading}>
        <UserRound size={34} />
        <strong>Opening Your Teacher Profile…</strong>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <ActionWaitOverlay visible={saving} message="Please wait…" />
      <div className={styles.shell}>
        <nav className={styles.topbar}>
          <a href="/portal"><ArrowLeft size={16} />Back to Portal</a>
        </nav>

        <header className={styles.header}>
          <div className={styles.avatar}><UserRound size={30} /></div>
          <div className={styles.headerCopy}>
            <span>{personnelType === "non_teaching" ? "MY PERSONNEL PROFILE" : "MY TEACHER PROFILE"}</span>
            <h1>{teacher?.full_name || "Personnel Profile"}</h1>
            <p>Asuncion National High School personnel profile</p>
          </div>
        </header>

        {error && <div className={styles.error}>{error}</div>}
        {message && <div className={styles.success}>{message}</div>}
        {missingRequired.length > 0 && (
          <div className={styles.requiredNotice}>
            <ShieldCheck size={20} />
            <div>
              <strong>Profile Information Needs Completion</strong>
              <span>Required: {missingRequired.join(", ")}</span>
            </div>
          </div>
        )}

        <section className={styles.panel}>
          <div className={styles.panelHead}>
            <BriefcaseBusiness size={22} />
            <h2>Employment Information</h2>
          </div>
          <dl className={styles.official}>
            <div>
              <dt>Position</dt>
              <dd>{teacher?.position || "Not yet recorded"}</dd>
            </div>
            <div>
              <dt>Date of Original Appointment</dt>
              <dd>{formatDate(appointmentDate)}</dd>
            </div>
            <div>
              <dt>DepEd Email</dt>
              <dd>{teacher?.email || "Not yet recorded"}</dd>
            </div>
          </dl>
        </section>

        <div className={styles.notice}>
          <ShieldCheck size={20} />
          <div>
            <strong>You can update the profile information below.</strong>
            <span>
              Complete the required profile fields below. Employment details, service records,
              salary information, and performance ratings are maintained by Human Resources.
            </span>
          </div>
        </div>

        <section className={styles.panel}>
          <div className={styles.panelHead}>
            <UserRound size={22} />
            <h2>Name</h2>
          </div>
          <div className={styles.grid}>
            {nameFields.map(([key, label]) => field(key, label))}
          </div>
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHead}>
            <GraduationCap size={22} />
            <div>
              <h2>Graduate Studies</h2>
              <p>Required. Select the status that currently applies to you.</p>
            </div>
          </div>
          <div className={styles.grid}>
            <label>
              <span>Graduate Studies Status <b className={styles.required}>Required</b></span>
              <select
                value={graduateStatus}
                onChange={(event) => {
                  const value = event.target.value;
                  setPersonal((current) => ({
                    ...current,
                    graduate_status: value,
                    graduate_units_earned:
                      value === "ON GOING" ? current.graduate_units_earned ?? "" : "",
                    graduate_car_completed:
                      value === "ON GOING" ? current.graduate_car_completed ?? "NO" : "NO",
                  }));
                }}
              >
                <option value="">Select Status</option>
                <option value="GRADUATED">Graduated</option>
                <option value="ON GOING">On Going</option>
                <option value="NONE">None</option>
              </select>
            </label>

            {graduateStatus !== "NONE" && graduateStatus !== "" && (
              <label>
                <span>Graduate Degree / Program</span>
                <input
                  value={personal.graduate_course ?? ""}
                  onChange={(event) =>
                    setPersonal((current) => ({
                      ...current,
                      graduate_course: event.target.value,
                    }))
                  }
                  placeholder="Example: Master of Arts in Education"
                />
              </label>
            )}

            {graduateStatus === "ON GOING" && (
              <>
                <label>
                  <span>Units Earned</span>
                  <input
                    type="number"
                    min="0"
                    max="999"
                    step="0.5"
                    value={personal.graduate_units_earned ?? ""}
                    onChange={(event) =>
                      setPersonal((current) => ({
                        ...current,
                        graduate_units_earned: event.target.value,
                      }))
                    }
                    placeholder="Example: 30"
                  />
                </label>
                <label className={styles.checkboxField}>
                  <input
                    type="checkbox"
                    checked={(personal.graduate_car_completed ?? "NO") === "YES"}
                    onChange={(event) =>
                      setPersonal((current) => ({
                        ...current,
                        graduate_car_completed: event.target.checked ? "YES" : "NO",
                      }))
                    }
                  />
                  <span>Completed Academic Requirements (CAR)</span>
                </label>
              </>
            )}
          </div>
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHead}>
            <GraduationCap size={22} />
            <h2>Tertiary (Bachelor&apos;s Degree)</h2>
          </div>
          <div className={styles.grid}>
            {tertiaryFields.map(([key, label]) =>
              key === "bachelors_degree" ? (
                <label key={key}>
                  <span>Bachelor&apos;s Degree <b className={styles.required}>Required</b></span>
                  <input
                    required
                    value={personal[key] ?? ""}
                    onChange={(event) =>
                      setPersonal((current) => ({ ...current, [key]: event.target.value }))
                    }
                    placeholder="Example: Bachelor of Secondary Education"
                  />
                </label>
              ) : field(key, label)
            )}
          </div>
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHead}>
            <GraduationCap size={22} />
            <h2>BSED-Earning Units</h2>
          </div>
          <div className={styles.grid}>
            {earningUnitsFields.map(([key, label]) => field(key, label))}
          </div>
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHead}>
            <BookOpenCheck size={22} />
            <h2>Other Profile Information</h2>
          </div>
          <div className={styles.grid}>
            {otherFields.map(([key, label]) =>
              key === "philsys_number" ? (
                <label key={key}>
                  <span>PhilSys (National ID) Number <b className={styles.required}>Required</b></span>
                  <input
                    required
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={25}
                    value={personal[key] ?? ""}
                    onChange={(event) =>
                      setPersonal((current) => ({
                        ...current,
                        [key]: formatPhilSysInput(event.target.value),
                      }))
                    }
                    placeholder="1234 - 5678 - 9012 - 3456"
                  />
                  <small className={styles.fieldHint}>16 digits · xxxx - xxxx - xxxx - xxxx</small>
                </label>
              ) : field(key, label, key === "skills", key === "skills")
            )}
          </div>
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHead}>
            <BriefcaseBusiness size={22} />
            <div>
              <h2>Service Records</h2>
              <p>{record.service_records?.length ?? 0} HR-maintained record(s)</p>
            </div>
          </div>
          {(record.service_records ?? []).length === 0 ? (
            <p className={styles.empty}>Service history has not been encoded yet.</p>
          ) : (
            <div className={styles.cards}>
              {record.service_records.map((item, index) => (
                <article key={index}>
                  <strong>{item.designation || "Service record"}</strong>
                  <span>{[item.date_from, item.date_to || "Present"].filter(Boolean).join(" to ")}</span>
                  <small>{[item.status, item.station].filter(Boolean).join(" · ")}</small>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHead}>
            <BookOpenCheck size={22} />
            <div>
              <h2>Performance Ratings</h2>
              <p>{record.ratings?.length ?? 0} HR-maintained rating(s)</p>
            </div>
          </div>
          {(record.ratings ?? []).length === 0 ? (
            <p className={styles.empty}>Performance ratings have not been encoded yet.</p>
          ) : (
            <div className={styles.cards}>
              {record.ratings.map((item, index) => (
                <article key={index}>
                  <strong>{item.period || "Performance rating"}</strong>
                  <span>{[item.rating, item.description].filter(Boolean).join(" · ")}</span>
                  <small>{item.instrument || ""}</small>
                </article>
              ))}
            </div>
          )}
        </section>

        <div className={styles.saveBar}>
          <button onClick={() => void save()} disabled={saving}>
            <Save size={17} />{saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </main>
  );
}
