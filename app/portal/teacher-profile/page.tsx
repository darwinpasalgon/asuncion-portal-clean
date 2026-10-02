"use client";

import { useEffect, useMemo, useState } from "react";
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

const personalSections = [
  {
    title: "Personal information",
    icon: UserRound,
    fields: [
      ["last_name", "Last name"],
      ["first_name", "First name"],
      ["middle_name", "Middle name"],
      ["name_extension", "Name extension"],
      ["birth_date", "Birth date"],
      ["birth_place", "Place of birth"],
      ["mobile", "Mobile number"],
      ["address", "Home address"],
    ],
  },
  {
    title: "Educational background",
    icon: GraduationCap,
    fields: [
      ["bachelors_degree", "Bachelor's degree / course"],
      ["major", "Major"],
      ["minor", "Minor"],
      ["education_units_major", "Education units earned / major"],
      ["education_units_minor", "Education units earned / minor"],
      ["graduate_course", "Graduate course / master's degree"],
      ["graduate_units", "Graduate units earned / CAR"],
      ["additional_units", "Additional units earned / CAR"],
    ],
  },
  {
    title: "Qualifications and other information",
    icon: BookOpenCheck,
    fields: [
      ["skills", "Skills / specialization / NC / trainers methodology"],
      ["philsys_number", "PhilSys (National ID) number"],
      ["religion", "Religion"],
      ["ethnic_group", "Ethnic group"],
    ],
  },
] as const;

const officialLabels: Record<string, string> = {
  appointment_day_month_source: "Original appointment day / month (source)",
  appointment_year_source: "Original appointment year (source)",
  appointment_date: "Verified original appointment date",
  employment_status: "Employment status",
  employee_number: "Employee number",
  employment_end_date: "Employment end date",
  salary_grade: "Salary grade / step",
  monthly_salary: "Monthly salary",
  hr_notes: "HR notes",
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

  const officialEntries = useMemo(
    () =>
      Object.entries(record.official ?? {}).filter(
        ([, value]) => String(value ?? "").trim() !== ""
      ),
    [record.official]
  );

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
            <p>
              {teacher?.position || "Teacher"} · {teacher?.email}
            </p>
          </div>
        </header>

        {error && <div className={styles.error}>{error}</div>}
        {message && <div className={styles.success}>{message}</div>}

        <div className={styles.notice}>
          <ShieldCheck size={20} />
          <div>
            <strong>You may update your personal profile information.</strong>
            <span>
              Appointment details, official service records, salary information, and performance
              ratings are maintained by Human Resources.
            </span>
          </div>
        </div>

        {personalSections.map((section) => {
          const Icon = section.icon;
          return (
            <section className={styles.panel} key={section.title}>
              <div className={styles.panelHead}>
                <Icon size={22} />
                <h2>{section.title}</h2>
              </div>
              <div className={styles.grid}>
                {section.fields.map(([key, label]) => (
                  <label className={key === "address" || key === "skills" ? styles.wide : ""} key={key}>
                    <span>{label}</span>
                    {key === "address" || key === "skills" ? (
                      <textarea
                        value={personal[key] ?? ""}
                        onChange={(event) =>
                          setPersonal((current) => ({ ...current, [key]: event.target.value }))
                        }
                        rows={3}
                      />
                    ) : (
                      <input
                        type={key === "birth_date" ? "date" : "text"}
                        value={personal[key] ?? ""}
                        onChange={(event) =>
                          setPersonal((current) => ({ ...current, [key]: event.target.value }))
                        }
                      />
                    )}
                  </label>
                ))}
              </div>
            </section>
          );
        })}

        <section className={styles.panel}>
          <div className={styles.panelHead}>
            <BriefcaseBusiness size={22} />
            <div>
              <h2>Official employment information</h2>
              <p>Read-only. Contact Human Resources if an official record needs correction.</p>
            </div>
          </div>
          {officialEntries.length === 0 ? (
            <p className={styles.empty}>No verified official employment fields have been entered yet.</p>
          ) : (
            <dl className={styles.official}>
              {officialEntries.map(([key, value]) => (
                <div key={key}>
                  <dt>{officialLabels[key] ?? key.replaceAll("_", " ")}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          )}
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHead}>
            <BriefcaseBusiness size={22} />
            <div>
              <h2>Service records</h2>
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
              <h2>Performance ratings</h2>
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
            <strong>Personal information</strong>
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
