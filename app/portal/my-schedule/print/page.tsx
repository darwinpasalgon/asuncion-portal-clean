"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CalendarDays, Printer } from "lucide-react";
import styles from "./schedule-print.module.css";

type Profile = {
  id: string;
  full_name: string;
  role: string;
};

type ScheduleEntry = {
  id: string;
  entry_type?: "class" | "block" | "rotation";
  day_of_week: number;
  start_time: string;
  end_time: string;
  room: string | null;
  grade_level: number | null;
  section: string;
  subject: string;
  major: string | null;
  purpose?: string | null;
  instructor?: string | null;
};

const DAY_NAMES = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function timeLabel(value: string) {
  return new Date(`1970-01-01T${value}`).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function TeacherSchedulePrintPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [schoolYear, setSchoolYear] = useState("");
  const [entries, setEntries] = useState<ScheduleEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const [profileResponse, scheduleResponse] = await Promise.all([
          fetch("/api/auth/me", { cache: "no-store" }),
          fetch("/api/academic/my-schedule", { cache: "no-store" }),
        ]);
        const [profileResult, scheduleResult] = await Promise.all([
          profileResponse.json().catch(() => ({})),
          scheduleResponse.json().catch(() => ({})),
        ]);

        if (!profileResponse.ok || profileResult.profile?.role !== "teacher") {
          throw new Error("Teacher access is required to print this schedule.");
        }
        if (!scheduleResponse.ok) {
          throw new Error(scheduleResult.error ?? "Unable to load your class schedule.");
        }
        if (!active) return;
        setProfile(profileResult.profile);
        setSchoolYear(scheduleResult.activeYear?.name ?? "");
        setEntries(scheduleResult.schedules ?? []);
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Unable to load your class schedule.");
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, []);

  const days = useMemo(
    () =>
      [1, 2, 3, 4, 5, 6, 7]
        .map((day) => ({
          day,
          entries: entries.filter((entry) => entry.day_of_week === day),
        }))
        .filter((item) => item.entries.length > 0),
    [entries]
  );

  return (
    <main className={styles.page}>
      <div className={styles.controls}>
        <a href="/portal?open=schedule">
          <ArrowLeft size={16} />
          Back to Class Schedule
        </a>
        <button type="button" onClick={() => window.print()} disabled={loading || entries.length === 0}>
          <Printer size={16} />
          Print Schedule
        </button>
      </div>

      <section className={styles.sheet}>
        <header className={styles.header}>
          <img src="/school-logo.png" alt="" />
          <div>
            <span>Republic of the Philippines</span>
            <span>Department of Education</span>
            <strong>ASUNCION NATIONAL HIGH SCHOOL</strong>
            <span>Cambanogoy, Asuncion, Davao del Norte</span>
          </div>
        </header>

        <div className={styles.title}>
          <CalendarDays size={24} />
          <div>
            <h1>Teacher Class Schedule</h1>
            <p>School Year {schoolYear || "Current School Year"}</p>
          </div>
        </div>

        <div className={styles.teacherLine}>
          <span>Teacher</span>
          <strong>{profile?.full_name || "Teacher"}</strong>
        </div>

        {error ? (
          <div className={styles.message}>{error}</div>
        ) : loading ? (
          <div className={styles.message}>Loading class schedule…</div>
        ) : days.length === 0 ? (
          <div className={styles.message}>No official class schedule is currently assigned.</div>
        ) : (
          <div className={styles.schedule}>
            {days.map(({ day, entries: dayEntries }) => (
              <section key={day} className={styles.day}>
                <h2>{DAY_NAMES[day]}</h2>
                <table>
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Grade & Section</th>
                      <th>Subject / TVE Major</th>
                      <th>Room / Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dayEntries.map((entry) => (
                      <tr key={entry.id}>
                        <td>{timeLabel(entry.start_time)} – {timeLabel(entry.end_time)}</td>
                        <td>{entry.grade_level ? `Grade ${entry.grade_level} · ` : ""}{entry.section}</td>
                        <td>
                          {entry.subject}
                          {entry.major ? <><br /><small>{entry.major}</small></> : null}
                        </td>
                        <td>
                          {entry.entry_type === "rotation"
                            ? entry.purpose || entry.instructor || "TVE Rotation"
                            : entry.entry_type === "block"
                              ? entry.purpose || "Non-Instructional Period"
                              : entry.room || "Room Not Specified"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            ))}
          </div>
        )}

        <footer className={styles.footer}>
          <span>Generated from the ANHS Academic Portal</span>
          <span>{profile?.full_name || ""}</span>
        </footer>
      </section>
    </main>
  );
}
