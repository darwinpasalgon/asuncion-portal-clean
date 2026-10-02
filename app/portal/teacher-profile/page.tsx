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

const otherFields = [
  ["skills", "SKILLS / SPECIALIZATION (NC I, NC II, NC III / TRAINERS METHODOLOGY)"],
  ["philsys_number", "Philsys (National ID) Number"],
  ["religion", "Religion"],
  ["ethnic_group", "Ethnic Group"],
] as const;

export default function MyTeacherProfilePage() {
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [record, setRecord] = useState<TeacherRecord>(emptyRecord());
  const [personal, setPersonal] = useState<Details>({});
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
      if (!response.ok) throw new Error(result.error ?? "Unable to load your Teacher Profile.");
      setTeacher(result.teacher ?? null);
      setRecord(result.record ?? emptyRecord());
      setPersonal(result.record?.personal ?? {});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load your Teacher Profile.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadProfile();
  }, []);

  async function save() {
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
      setMessage("Teacher Profile saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save your Teacher Profile.");
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

  if (loading) {
    return (
      <main className={styles.loading}>
        <UserRound size={34} />
        <strong>Opening your Teacher Profile…</strong>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <ActionWaitOverlay visible={saving} message="Please wait…" />
      <div className={styles.shell}>
        <nav className={styles.topbar}>
          <a href="/portal"><ArrowLeft size={16} />Back to portal</a>
          <span><ShieldCheck size={16} />Official HR fields are protected</span>
        </nav>

        <header className={styles.header}>
          <div className={styles.avatar}><UserRound size={30} /></div>
          <div>
            <span>MY TEACHER PROFILE</span>
            <h1>{teacher?.full_name || "Teacher Profile"}</h1>
            <p>Asuncion National High School personnel profile</p>
          </div>
        </header>

        {error && <div className={styles.error}>{error}</div>}
        {message && <div className={styles.success}>{message}</div>}

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
            <strong>You may update the editable profile information below.</strong>
            <span>
              Position, Date of Original Appointment, service records, salary information, and
              performance ratings are maintained by Human Resources.
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
            <h2>Graduate Studies</h2>
          </div>
          <div className={styles.grid}>
            {graduateFields.map(([key, label]) => field(key, label, key === "graduate_units"))}
          </div>
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHead}>
            <GraduationCap size={22} />
            <h2>Tertiary (Bachelor&apos;s Degree)</h2>
          </div>
          <div className={styles.grid}>
            {tertiaryFields.map(([key, label]) => field(key, label))}
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
              field(key, label, key === "skills", key === "skills")
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
          <div>
            <strong>Teacher&apos;s Profile</strong>
            <span>Changes are recorded with a profile version and update history.</span>
          </div>
          <button onClick={() => void save()} disabled={saving}>
            <Save size={17} />{saving ? "Saving…" : "Save Teacher Profile"}
          </button>
        </div>
      </div>
    </main>
  );
}
