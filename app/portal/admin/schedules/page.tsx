"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock3,
  MapPin,
  Pencil,
  Plus,
  RefreshCw,
  School,
} from "lucide-react";
import styles from "./schedules.module.css";

type Year = { id: string; name: string };
type Assignment = {
  id: string;
  teacher_id: string;
  grade_level: number;
  section_id: string;
  subject_id: string;
};
type Section = { id: string; name: string; grade_level: number };
type Subject = { id: string; name: string; code: string | null; grade_level: number };
type Teacher = { id: string; full_name: string };
type Schedule = {
  id: string;
  teacher_assignment_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  room: string | null;
  is_active: boolean;
};

type DayDraft = {
  startTime: string;
  endTime: string;
  room: string;
};

const DAYS = [
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
  { value: 7, label: "Sunday" },
];

function timeLabel(value: string) {
  const [hourText, minute] = value.slice(0, 5).split(":");
  const hour = Number(hourText);
  const suffix = hour >= 12 ? "PM" : "AM";
  const display = hour % 12 || 12;
  return `${display}:${minute} ${suffix}`;
}

export default function ClassSchedulesPage() {
  const [activeYear, setActiveYear] = useState<Year | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [dayDrafts, setDayDrafts] = useState<Record<number, DayDraft>>({});
  const [editId, setEditId] = useState("");
  const [editAssignment, setEditAssignment] = useState("");
  const [editDay, setEditDay] = useState("");
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");
  const [editRoom, setEditRoom] = useState("");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/class-schedules", { cache: "no-store" });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(result.error ?? "Unable to load class schedules.");
        return;
      }
      setActiveYear(result.activeYear ?? null);
      setAssignments(result.assignments ?? []);
      setSections(result.sections ?? []);
      setSubjects(result.subjects ?? []);
      setTeachers(result.teachers ?? []);
      setSchedules(result.schedules ?? []);
    } catch {
      setError("Unable to reach the class schedule service.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const lookup = useMemo(() => {
    const sectionsById = new Map(sections.map((item) => [item.id, item.name]));
    const subjectsById = new Map(
      subjects.map((item) => [item.id, { name: item.name, code: item.code }])
    );
    const teachersById = new Map(teachers.map((item) => [item.id, item.full_name]));
    const assignmentsById = new Map(assignments.map((item) => [item.id, item]));
    return { sectionsById, subjectsById, teachersById, assignmentsById };
  }, [sections, subjects, teachers, assignments]);

  function assignmentLabel(assignment: Assignment) {
    const subject = lookup.subjectsById.get(assignment.subject_id);
    return [
      `Grade ${assignment.grade_level}`,
      lookup.sectionsById.get(assignment.section_id) ?? "Unknown section",
      subject?.name ?? "Unknown subject",
      lookup.teachersById.get(assignment.teacher_id) ?? "Unknown teacher",
    ].join(" · ");
  }

  function resetForm() {
    setEditId("");
    setEditAssignment("");
    setEditDay("");
    setEditStart("");
    setEditEnd("");
    setEditRoom("");
    setSelectedDays([]);
    setDayDrafts({});
  }

  function toggleDay(day: number) {
    setSelectedDays((current) => {
      const exists = current.includes(day);
      const next = exists
        ? current.filter((value) => value !== day)
        : [...current, day].sort((a, b) => a - b);

      setDayDrafts((drafts) => {
        if (exists) {
          const copy = { ...drafts };
          delete copy[day];
          return copy;
        }
        return {
          ...drafts,
          [day]: drafts[day] ?? { startTime: "", endTime: "", room: "" },
        };
      });

      return next;
    });
  }

  function selectWeekdays() {
    const weekdays = [1, 2, 3, 4, 5];
    setSelectedDays(weekdays);
    setDayDrafts((drafts) => {
      const next = { ...drafts };
      for (const day of weekdays) {
        if (!next[day]) next[day] = { startTime: "", endTime: "", room: "" };
      }
      return next;
    });
  }

  function clearDays() {
    setSelectedDays([]);
    setDayDrafts({});
  }

  function updateDayDraft(day: number, field: keyof DayDraft, value: string) {
    setDayDrafts((current) => ({
      ...current,
      [day]: {
        ...(current[day] ?? { startTime: "", endTime: "", room: "" }),
        [field]: value,
      },
    }));
  }

  function startEdit(schedule: Schedule) {
    setEditId(schedule.id);
    setEditAssignment(schedule.teacher_assignment_id);
    setEditDay(String(schedule.day_of_week));
    setEditStart(schedule.start_time.slice(0, 5));
    setEditEnd(schedule.end_time.slice(0, 5));
    setEditRoom(schedule.room ?? "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function saveSchedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setWorking("save");
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/admin/class-schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          editId
            ? {
                action: "save_schedule",
                id: editId,
                assignmentId: editAssignment,
                dayOfWeek: Number(editDay),
                startTime: editStart,
                endTime: editEnd,
                room: editRoom,
              }
            : {
                action: "save_schedule",
                assignmentId: editAssignment,
                entries: selectedDays.map((day) => ({
                  dayOfWeek: day,
                  startTime: dayDrafts[day]?.startTime ?? "",
                  endTime: dayDrafts[day]?.endTime ?? "",
                  room: dayDrafts[day]?.room ?? "",
                })),
              }
        ),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(result.error ?? "Unable to save the schedule.");
        return;
      }

      setSuccess(
        editId
          ? "Schedule updated."
          : `${result.count ?? selectedDays.length} schedule entr${(result.count ?? selectedDays.length) === 1 ? "y" : "ies"} added.`
      );
      resetForm();
      await load();
    } catch {
      setError("Unable to reach the class schedule service.");
    } finally {
      setWorking("");
    }
  }

  async function setScheduleActive(schedule: Schedule, isActive: boolean) {
    setWorking(schedule.id);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/admin/class-schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "set_schedule_active",
          id: schedule.id,
          isActive,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(result.error ?? "Unable to update the schedule.");
        return;
      }

      setSuccess(`Schedule ${isActive ? "reactivated" : "deactivated"}.`);
      await load();
    } catch {
      setError("Unable to reach the class schedule service.");
    } finally {
      setWorking("");
    }
  }

  const orderedSchedules = [...schedules].sort((a, b) => {
    if (a.day_of_week !== b.day_of_week) return a.day_of_week - b.day_of_week;
    return a.start_time.localeCompare(b.start_time);
  });

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <nav className={styles.topActions}>
          <a href="/portal" className={styles.topLink}>
            <ArrowLeft size={16} /> Back to portal
          </a>
          <a href="/portal/admin/teaching" className={styles.topLink}>
            Subjects & teachers
          </a>
        </nav>

        <header className={styles.header}>
          <div>
            <span className={styles.eyebrow}>ADMINISTRATION</span>
            <h1>Class schedules</h1>
            <p>
              Schedule the class assignments already configured for the active
              school year. Teacher, section, and room conflicts are blocked automatically.
            </p>
          </div>
          {activeYear && (
            <div className={styles.activeYear}>
              <CheckCircle2 size={18} />
              <div>
                <span>ACTIVE SCHOOL YEAR</span>
                <strong>{activeYear.name}</strong>
              </div>
            </div>
          )}
        </header>

        {error && <div className={styles.error}>{error}</div>}
        {success && <div className={styles.success}>{success}</div>}

        <section className={styles.panel}>
          <div className={styles.panelHeading}>
            <div>
              <h2>{editId ? "Edit schedule" : "Add schedule"}</h2>
              <p>
                Only active Teacher assignments for the current school year can be scheduled.
              </p>
            </div>
            {editId && (
              <button type="button" className={styles.secondary} onClick={resetForm}>
                Cancel edit
              </button>
            )}
          </div>

          <form className={styles.form} onSubmit={saveSchedule}>
            <label className={styles.assignmentField}>
              <span>Class assignment</span>
              <select
                required
                value={editAssignment}
                onChange={(event) => setEditAssignment(event.target.value)}
              >
                <option value="">Select class assignment</option>
                {assignments.map((assignment) => (
                  <option key={assignment.id} value={assignment.id}>
                    {assignmentLabel(assignment)}
                  </option>
                ))}
              </select>
            </label>

            {editId ? (
              <div className={styles.editGrid}>
                <label>
                  <span>Day</span>
                  <select
                    required
                    value={editDay}
                    onChange={(event) => setEditDay(event.target.value)}
                  >
                    <option value="">Select day</option>
                    {DAYS.map((day) => (
                      <option key={day.value} value={day.value}>{day.label}</option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>Start time</span>
                  <input
                    required
                    type="time"
                    value={editStart}
                    onChange={(event) => setEditStart(event.target.value)}
                  />
                </label>

                <label>
                  <span>End time</span>
                  <input
                    required
                    type="time"
                    value={editEnd}
                    onChange={(event) => setEditEnd(event.target.value)}
                  />
                </label>

                <label>
                  <span>Room / location <small>optional</small></span>
                  <input
                    maxLength={80}
                    placeholder="e.g. Computer Laboratory"
                    value={editRoom}
                    onChange={(event) => setEditRoom(event.target.value)}
                  />
                </label>
              </div>
            ) : (
              <>
                <div className={styles.daySelector}>
                  <div className={styles.daySelectorHeading}>
                    <div>
                      <span>Teaching days</span>
                      <small>Select every day this class meets. Each day can have a different time and room.</small>
                    </div>
                    <div className={styles.dayHelpers}>
                      <button type="button" className={styles.secondary} onClick={selectWeekdays}>
                        Select Monday–Friday
                      </button>
                      <button type="button" className={styles.secondary} onClick={clearDays}>
                        Clear days
                      </button>
                    </div>
                  </div>

                  <div className={styles.dayChoices}>
                    {DAYS.map((day) => {
                      const selected = selectedDays.includes(day.value);
                      return (
                        <button
                          key={day.value}
                          type="button"
                          className={selected ? styles.daySelected : styles.dayChoice}
                          onClick={() => toggleDay(day.value)}
                          aria-pressed={selected}
                        >
                          {day.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {selectedDays.length > 0 && (
                  <div className={styles.dayScheduleGrid}>
                    <div className={styles.dayScheduleHeader}>
                      <span>Day</span>
                      <span>Start time</span>
                      <span>End time</span>
                      <span>Room / location</span>
                    </div>

                    {selectedDays.map((day) => {
                      const dayInfo = DAYS.find((item) => item.value === day);
                      const draft = dayDrafts[day] ?? {
                        startTime: "",
                        endTime: "",
                        room: "",
                      };

                      return (
                        <div className={styles.dayScheduleRow} key={day}>
                          <strong>{dayInfo?.label}</strong>
                          <input
                            required
                            type="time"
                            aria-label={`${dayInfo?.label} start time`}
                            value={draft.startTime}
                            onChange={(event) =>
                              updateDayDraft(day, "startTime", event.target.value)
                            }
                          />
                          <input
                            required
                            type="time"
                            aria-label={`${dayInfo?.label} end time`}
                            value={draft.endTime}
                            onChange={(event) =>
                              updateDayDraft(day, "endTime", event.target.value)
                            }
                          />
                          <input
                            maxLength={80}
                            aria-label={`${dayInfo?.label} room or location`}
                            placeholder="Optional"
                            value={draft.room}
                            onChange={(event) =>
                              updateDayDraft(day, "room", event.target.value)
                            }
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}

            <div className={styles.formActions}>
              <button
                type="submit"
                disabled={
                  working === "save" ||
                  assignments.length === 0 ||
                  (!editId && selectedDays.length === 0)
                }
              >
                {editId ? <Pencil size={17} /> : <Plus size={17} />}
                {working === "save"
                  ? "Saving…"
                  : editId
                    ? "Update schedule"
                    : selectedDays.length > 1
                      ? `Add ${selectedDays.length} schedule entries`
                      : "Add schedule"}
              </button>
            </div>
          </form>
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHeading}>
            <div>
              <h2>Published class schedule</h2>
              <p>Active entries appear automatically in Student and Teacher dashboards.</p>
            </div>
            <button className={styles.secondary} onClick={() => void load()} disabled={loading}>
              <RefreshCw size={16} /> Refresh
            </button>
          </div>

          {loading ? (
            <div className={styles.empty}>Loading schedules…</div>
          ) : orderedSchedules.length === 0 ? (
            <div className={styles.empty}>
              <CalendarDays size={30} />
              <strong>No class schedules yet</strong>
              <span>Add the first real schedule above.</span>
            </div>
          ) : (
            <div className={styles.scheduleList}>
              {orderedSchedules.map((schedule) => {
                const assignment = lookup.assignmentsById.get(schedule.teacher_assignment_id);
                const subject = assignment
                  ? lookup.subjectsById.get(assignment.subject_id)
                  : null;

                return (
                  <article key={schedule.id} className={styles.scheduleRow}>
                    <div className={styles.dayBox}>
                      <CalendarDays size={18} />
                      <strong>{DAYS.find((day) => day.value === schedule.day_of_week)?.label}</strong>
                    </div>

                    <div>
                      <span>CLASS</span>
                      <strong>
                        {assignment
                          ? `Grade ${assignment.grade_level} · ${lookup.sectionsById.get(assignment.section_id) ?? "Unknown"}`
                          : "Unknown class"}
                      </strong>
                      <small>
                        {subject?.name ?? "Unknown subject"}
                        {subject?.code ? ` (${subject.code})` : ""}
                      </small>
                    </div>

                    <div>
                      <span>TEACHER</span>
                      <strong>
                        {assignment
                          ? lookup.teachersById.get(assignment.teacher_id) ?? "Unknown teacher"
                          : "Unknown teacher"}
                      </strong>
                    </div>

                    <div>
                      <span>TIME & ROOM</span>
                      <strong className={styles.inline}>
                        <Clock3 size={15} />
                        {timeLabel(schedule.start_time)} – {timeLabel(schedule.end_time)}
                      </strong>
                      <small className={styles.inline}>
                        <MapPin size={14} />
                        {schedule.room || "Room not specified"}
                      </small>
                    </div>

                    <div className={styles.actions}>
                      <button className={styles.edit} onClick={() => startEdit(schedule)}>
                        <Pencil size={15} /> Edit
                      </button>
                      <button
                        className={schedule.is_active ? styles.active : styles.inactive}
                        disabled={working === schedule.id}
                        onClick={() => void setScheduleActive(schedule, !schedule.is_active)}
                      >
                        {schedule.is_active ? "Active" : "Inactive"}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
