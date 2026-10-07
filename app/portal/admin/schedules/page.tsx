"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { findScheduleConflicts, normalizedRoom, type ProposedPeriod, type ScheduleConflict } from "@/lib/schedule-conflicts";
import {
  ArrowLeft,
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock3,
  MapPin,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  WandSparkles,
} from "lucide-react";
import styles from "./schedules.module.css";

type Year = { id: string; name: string };
type Assignment = {
  id: string;
  teacher_id: string;
  grade_level: number;
  section_id: string;
  subject_id: string;
  major: string | null;
  co_teacher_ids?: string[];
};
type Section = {
  id: string;
  name: string;
  grade_level: number;
  is_active?: boolean;
};
type Subject = { id: string; name: string; grade_level: number };
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

type Grade7TveRotation = {
  id: string;
  rotation_block: "MORNING" | "MIDDAY" | "AFTERNOON";
  group_label: string;
  section_id: string | null;
  phase_no: number;
  starts_on: string;
  ends_on: string;
  major_code: "AGRI-CROP" | "ANIMAL" | "CSS" | "EIM" | "FOOD";
  teacher_id: string | null;
  non_teaching_personnel_id: string | null;
  instructor_name: string;
  days_of_week: number[];
  start_time: string;
  end_time: string;
};

type ScheduleBlock = {
  id: string;
  school_year_id: string;
  grade_level: number;
  section_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  label: string;
  purpose: string | null;
  block_type: "non_instructional";
  is_active: boolean;
};

type DayDraft = {
  startTime: string;
  endTime: string;
  room: string;
};

type QuickDraft = {
  days: number[];
  startTime: string;
  endTime: string;
  room: string;
};

type ReviewOrigin = {
  scheduleView: "section" | "teacher";
  quickGrade: string;
  quickSection: string;
  quickTeacher: string;
  roomFilter: string;
  advancedOpen: boolean;
  editId: string;
  editAssignment: string;
  editDay: string;
  editStart: string;
  editEnd: string;
  editRoom: string;
  selectedDays: number[];
  dayDrafts: Record<number, DayDraft>;
  quickDrafts: Record<string, QuickDraft>;
  scrollY: number;
};

const DAYS = [
  { value: 1, label: "Monday", short: "Mon" },
  { value: 2, label: "Tuesday", short: "Tue" },
  { value: 3, label: "Wednesday", short: "Wed" },
  { value: 4, label: "Thursday", short: "Thu" },
  { value: 5, label: "Friday", short: "Fri" },
  { value: 6, label: "Saturday", short: "Sat" },
  { value: 7, label: "Sunday", short: "Sun" },
];

const WEEKDAYS = DAYS.slice(0, 5);
const SCHOOL_DAY_START = "07:30";
const SCHOOL_DAY_END = "16:30";

function validSchoolTimeRange(startTime: string, endTime: string) {
  return (
    Boolean(startTime) &&
    Boolean(endTime) &&
    startTime >= SCHOOL_DAY_START &&
    endTime <= SCHOOL_DAY_END &&
    startTime < endTime
  );
}

function grade7TveMajorLabel(code: Grade7TveRotation["major_code"]) {
  switch (code) {
    case "AGRI-CROP": return "Agriculture Crop Production";
    case "ANIMAL": return "Animal Production";
    case "CSS": return "Computer Systems Servicing";
    case "EIM": return "Electrical Installation and Maintenance";
    case "FOOD": return "Food Processing";
  }
}

function timeLabel(value: string) {
  const [hourText, minute] = value.slice(0, 5).split(":");
  const hour = Number(hourText);
  const suffix = hour >= 12 ? "PM" : "AM";
  const display = hour % 12 || 12;
  return `${display}:${minute} ${suffix}`;
}

function emptyQuickDraft(): QuickDraft {
  return { days: [], startTime: "", endTime: "", room: "" };
}

export default function ClassSchedulesPage() {
  const [activeYear, setActiveYear] = useState<Year | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [scheduleBlocks, setScheduleBlocks] = useState<ScheduleBlock[]>([]);
  const [grade7TveRotations, setGrade7TveRotations] = useState<Grade7TveRotation[]>([]);

  const [scheduleView, setScheduleView] = useState<"section" | "teacher">("section");
  const [quickTeacher, setQuickTeacher] = useState("");
  const [quickGrade, setQuickGrade] = useState("");
  const [quickSection, setQuickSection] = useState("");
  const [quickDrafts, setQuickDrafts] = useState<Record<string, QuickDraft>>({});

  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [dayDrafts, setDayDrafts] = useState<Record<number, DayDraft>>({});
  const [editId, setEditId] = useState("");
  const [editAssignment, setEditAssignment] = useState("");
  const [editDay, setEditDay] = useState("");
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");
  const [editRoom, setEditRoom] = useState("");
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [conflictDialog, setConflictDialog] = useState<{ message: string; conflicts: ScheduleConflict[] } | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [roomFilter, setRoomFilter] = useState("");
  const [highlightId, setHighlightId] = useState("");
  const [attentionAssignmentId, setAttentionAssignmentId] = useState("");
  const attentionInitialized = useRef(false);
  const [reviewOrigin, setReviewOrigin] = useState<ReviewOrigin | null>(null);

  useEffect(() => {
    if (conflictDialog && dialogRef.current && !dialogRef.current.open) {
      dialogRef.current.showModal();
      dialogRef.current.querySelector<HTMLElement>("h2")?.focus();
    }
  }, [conflictDialog]);

  useEffect(() => {
    if (!highlightId || loading || conflictDialog) return;
    const row = document.getElementById(`schedule-${highlightId}`);
    row?.scrollIntoView({ behavior: "smooth", block: "center" });
    row?.focus({ preventScroll: true });
  }, [highlightId, loading, conflictDialog]);

  function closeConflictDialog() {
    dialogRef.current?.close();
    setConflictDialog(null);
  }

  function showServerConflict(result: { code?: string; error?: string; conflicts?: ScheduleConflict[] }, prefix = "") {
    if (result.code !== "schedule_conflict" && !result.error?.startsWith("Schedule conflict:")) return;
    setConflictDialog({
      message: prefix + (result.error ?? "This schedule overlaps with an existing class."),
      conflicts: result.conflicts ?? [],
    });
  }

  function assignmentTeacherIds(assignment: Assignment) {
    return Array.from(new Set([assignment.teacher_id, ...(assignment.co_teacher_ids ?? [])]));
  }

  function assignmentTeacherNames(assignment: Assignment) {
    return assignmentTeacherIds(assignment)
      .map((id) => lookup.teachersById.get(id) ?? "Unknown Teacher")
      .join(" / ");
  }

  function checkLocalConflicts(assignment: Assignment, periods: ProposedPeriod[]) {
    const conflicts = findScheduleConflicts(assignment, periods, { assignments, schedules, teachers, sections, subjects });
    if (!conflicts.length) return false;
    const message = "This schedule overlaps with an existing class. Your requested change has not been saved.";
    setError(message);
    setSuccess("");
    setConflictDialog({ message, conflicts });
    return true;
  }

  function reviewConflict(conflict: ScheduleConflict, kind: "teacher" | "section" | "room") {
    if (!reviewOrigin) setReviewOrigin({
      scheduleView, quickGrade, quickSection, quickTeacher, roomFilter, advancedOpen,
      editId, editAssignment, editDay, editStart, editEnd, editRoom, selectedDays, dayDrafts, quickDrafts,
      scrollY: window.scrollY,
    });
    closeConflictDialog();
    setRoomFilter(kind === "room" ? conflict.schedule.room ?? "" : "");
    if (kind === "teacher") {
      changeView("teacher");
      setQuickTeacher(conflict.assignment.teacher_id);
    } else {
      changeView("section");
      setQuickGrade(kind === "section" ? String(conflict.assignment.grade_level) : "");
      setQuickSection(kind === "section" ? conflict.assignment.section_id : "");
    }
    // Keep a current snapshot visible even if the page was loaded before this entry existed.
    setSchedules((current) => [...current.filter((item) => item.id !== conflict.schedule.id), conflict.schedule]);
    setAssignments((current) => [...current.filter((item) => item.id !== conflict.assignment.id), conflict.assignment]);
    setTeachers((current) => current.some((item) => item.id === conflict.assignment.teacher_id) ? current :
      [...current, { id: conflict.assignment.teacher_id, full_name: conflict.teacherName }]);
    setSections((current) => current.some((item) => item.id === conflict.assignment.section_id) ? current :
      [...current, { id: conflict.assignment.section_id, name: conflict.sectionName, grade_level: conflict.assignment.grade_level }]);
    setSubjects((current) => current.some((item) => item.id === conflict.assignment.subject_id) ? current :
      [...current, { id: conflict.assignment.subject_id, name: conflict.subjectName, grade_level: conflict.assignment.grade_level }]);
    setHighlightId(conflict.schedule.id);
    setAdvancedOpen(false);
  }

  function returnToDraft() {
    if (!reviewOrigin) return;
    const origin = reviewOrigin;
    changeView(origin.scheduleView);
    setQuickGrade(origin.quickGrade);
    setQuickSection(origin.quickSection);
    setQuickTeacher(origin.quickTeacher);
    setRoomFilter(origin.roomFilter);
    setAdvancedOpen(origin.advancedOpen);
    setEditId(origin.editId);
    setEditAssignment(origin.editAssignment);
    setEditDay(origin.editDay);
    setEditStart(origin.editStart);
    setEditEnd(origin.editEnd);
    setEditRoom(origin.editRoom);
    setSelectedDays(origin.selectedDays);
    setDayDrafts(origin.dayDrafts);
    setQuickDrafts((current) => ({ ...current, ...origin.quickDrafts }));
    setHighlightId("");
    setReviewOrigin(null);
    window.requestAnimationFrame(() => window.scrollTo({ top: origin.scrollY, behavior: "smooth" }));
  }

  async function load(clearError = true, background = false) {
    const scrollY = background ? window.scrollY : 0;
    if (!background) setLoading(true);
    if (clearError) setError("");
    try {
      const response = await fetch("/api/admin/class-schedules", {
        cache: "no-store",
      });
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
      setScheduleBlocks(result.scheduleBlocks ?? []);
      setGrade7TveRotations(result.grade7TveRotations ?? []);
    } catch {
      setError("Unable to reach the class schedule service.");
    } finally {
      if (!background) {
        setLoading(false);
      } else {
        window.requestAnimationFrame(() => {
          window.requestAnimationFrame(() => {
            window.scrollTo({ top: scrollY, behavior: "auto" });
          });
        });
      }
    }
  }

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("view") === "teacher") {
      setScheduleView("teacher");
    }
    void load();
  }, []);

  useEffect(() => {
    if (loading || attentionInitialized.current) return;
    const params = new URLSearchParams(window.location.search);
    const assignmentId = params.get("assignment") ?? "";
    if (!assignmentId) return;

    const assignment = assignments.find((item) => item.id === assignmentId);
    if (!assignment) return;

    attentionInitialized.current = true;
    setScheduleView("section");
    setQuickGrade(String(assignment.grade_level));
    setQuickSection(params.get("section") || assignment.section_id);
    setAttentionAssignmentId(assignment.id);
    setRoomFilter("");
  }, [loading, assignments]);

  useEffect(() => {
    if (!attentionAssignmentId || loading || !quickSection) return;
    const timer = window.setTimeout(() => {
      const row = document.getElementById(`quick-assignment-${attentionAssignmentId}`);
      row?.scrollIntoView({ behavior: "smooth", block: "center" });
      row?.focus({ preventScroll: true });
      row?.querySelector<HTMLButtonElement>('button[aria-pressed]')?.focus({ preventScroll: true });
    }, 120);
    return () => window.clearTimeout(timer);
  }, [attentionAssignmentId, quickSection, loading]);

  function changeView(view: "section" | "teacher") {
    setScheduleView(view);
    setError("");
    setSuccess("");
    const url = new URL(window.location.href);
    url.searchParams.set("view", view);
    window.history.replaceState(null, "", url);
  }

  const teacherView = scheduleView === "teacher";
  const hasSelection = Boolean(teacherView ? quickTeacher : quickSection);
  const teacherOptions = useMemo(
    () => [...teachers].sort((a, b) => a.full_name.localeCompare(b.full_name)),
    [teachers]
  );

  const lookup = useMemo(() => {
    const sectionsById = new Map(sections.map((item) => [item.id, item.name]));
    const subjectsById = new Map(
      subjects.map((item) => [item.id, { name: item.name }])
    );
    const teachersById = new Map(
      teachers.map((item) => [item.id, item.full_name])
    );
    const assignmentsById = new Map(
      assignments.map((item) => [item.id, item])
    );
    return { sectionsById, subjectsById, teachersById, assignmentsById };
  }, [sections, subjects, teachers, assignments]);

  const gradeOptions = useMemo(
    () =>
      Array.from(
        new Set(
          sections
            .filter((section) => section.is_active !== false)
            .map((section) => section.grade_level)
            .filter((value) => Number.isInteger(value) && value >= 7 && value <= 12)
        )
      ).sort((a, b) => a - b),
    [sections]
  );

  const quickSectionOptions = useMemo(() => {
    if (!quickGrade) return [];
    const grade = Number(quickGrade);

    return sections
      .filter(
        (section) =>
          section.grade_level === grade && section.is_active !== false
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [sections, quickGrade]);

  const quickAssignments = useMemo(
    () =>
      assignments
        .filter((item) => teacherView
          ? assignmentTeacherIds(item).includes(quickTeacher)
          : item.section_id === quickSection)
        .sort((a, b) => {
          const subjectA = lookup.subjectsById.get(a.subject_id)?.name ?? "";
          const subjectB = lookup.subjectsById.get(b.subject_id)?.name ?? "";
          const bySubject = subjectA.localeCompare(subjectB);
          if (bySubject !== 0) return bySubject;
          const byMajor = String(a.major ?? "").localeCompare(String(b.major ?? ""));
          if (byMajor !== 0) return byMajor;
          return a.grade_level - b.grade_level ||
            (lookup.sectionsById.get(a.section_id) ?? "").localeCompare(
              lookup.sectionsById.get(b.section_id) ?? ""
            );
        }),
    [assignments, teacherView, quickTeacher, quickSection, lookup]
  );

  const quickSummary = useMemo(() => {
    const ids = new Set(quickAssignments.map((item) => item.id));
    const active = schedules.filter(
      (item) => item.is_active && ids.has(item.teacher_assignment_id)
    );
    const scheduledLoads = new Set(active.map((item) => item.teacher_assignment_id)).size;
    const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
    const weeklyMinutes = active.reduce(
      (total, item) => total + minutes(item.end_time) - minutes(item.start_time), 0
    );
    return { entries: active.length, scheduledLoads, weeklyHours: Number((weeklyMinutes / 60).toFixed(2)) };
  }, [quickAssignments, schedules]);

  function assignmentLabel(assignment: Assignment) {
    const subject = lookup.subjectsById.get(assignment.subject_id);
    return [
      `Grade ${assignment.grade_level}`,
      lookup.sectionsById.get(assignment.section_id) ?? "Unknown section",
      subject?.name ?? "Unknown subject",
      assignment.major ?? "",
      assignmentTeacherNames(assignment),
    ]
      .filter(Boolean)
      .join(" · ");
  }

  function schedulesForAssignment(assignmentId: string) {
    return schedules
      .filter(
        (schedule) =>
          schedule.teacher_assignment_id === assignmentId && schedule.is_active
      )
      .sort((a, b) => {
        if (a.day_of_week !== b.day_of_week) {
          return a.day_of_week - b.day_of_week;
        }
        return a.start_time.localeCompare(b.start_time);
      });
  }

  function updateQuickDraft(
    assignmentId: string,
    field: keyof Omit<QuickDraft, "days">,
    value: string
  ) {
    setQuickDrafts((current) => ({
      ...current,
      [assignmentId]: {
        ...(current[assignmentId] ?? emptyQuickDraft()),
        [field]: value,
      },
    }));
  }

  function toggleQuickDay(assignmentId: string, day: number) {
    setQuickDrafts((current) => {
      const draft = current[assignmentId] ?? emptyQuickDraft();
      const selected = draft.days.includes(day);
      return {
        ...current,
        [assignmentId]: {
          ...draft,
          days: selected
            ? draft.days.filter((value) => value !== day)
            : [...draft.days, day].sort((a, b) => a - b),
        },
      };
    });
  }

  function setQuickWeekdays(assignmentId: string) {
    setQuickDrafts((current) => ({
      ...current,
      [assignmentId]: {
        ...(current[assignmentId] ?? emptyQuickDraft()),
        days: [1, 2, 3, 4, 5],
      },
    }));
  }

  function clearQuickDraft(assignmentId: string) {
    setQuickDrafts((current) => ({
      ...current,
      [assignmentId]: emptyQuickDraft(),
    }));
  }

  async function saveQuickAssignment(assignment: Assignment) {
    if (working || loading) return;
    const draft = quickDrafts[assignment.id] ?? emptyQuickDraft();

    if (!draft.days.length) {
      setError("Select at least one day for this subject.");
      return;
    }
    if (!validSchoolTimeRange(draft.startTime, draft.endTime)) {
      setError("Class schedules must be between 7:30 AM and 4:30 PM.");
      return;
    }

    setWorking(`quick:${assignment.id}`);
    setError("");
    setSuccess("");

    let savedDays = 0;
    try {
      const existing = schedulesForAssignment(assignment.id);
      if (draft.days.some((day) => existing.filter((item) => item.day_of_week === day).length > 1)) {
        throw new Error("This assignment has multiple periods on a selected day. Click the specific Current entry to edit it in Advanced Schedule Entry.");
      }
      const existingByDay = new Map(
        existing.map((schedule) => [schedule.day_of_week, schedule])
      );

      if (checkLocalConflicts(assignment, draft.days.map((day) => ({
        id: existingByDay.get(day)?.id, day_of_week: day,
        start_time: draft.startTime, end_time: draft.endTime,
        room: draft.room.trim().replace(/\s+/g, " ") || null,
      })))) return;

      const newDays: number[] = [];

      for (const day of draft.days) {
        const current = existingByDay.get(day);
        if (!current) {
          newDays.push(day);
          continue;
        }

        const response = await fetch("/api/admin/class-schedules", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "save_schedule",
            id: current.id,
            assignmentId: assignment.id,
            dayOfWeek: day,
            startTime: draft.startTime,
            endTime: draft.endTime,
            room: draft.room,
          }),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
          showServerConflict(result, savedDays ? `${savedDays} day(s) saved before this conflict. ` : "");
          throw new Error(
            result.error ??
              `Unable to update the ${DAYS.find((item) => item.value === day)?.label ?? "selected day"} schedule.`
          );
        }
        savedDays += 1;
      }

      if (newDays.length) {
        const response = await fetch("/api/admin/class-schedules", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "save_schedule",
            assignmentId: assignment.id,
            entries: newDays.map((day) => ({
              dayOfWeek: day,
              startTime: draft.startTime,
              endTime: draft.endTime,
              room: draft.room,
            })),
          }),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
          showServerConflict(result, savedDays ? `${savedDays} day(s) saved before this conflict. ` : "");
          throw new Error(result.error ?? "Unable to save the selected days.");
        }
        savedDays += newDays.length;
      }

      const subject =
        lookup.subjectsById.get(assignment.subject_id)?.name ?? "Subject";
      setSuccess(
        `${subject} schedule saved for ${draft.days.length} day${draft.days.length === 1 ? "" : "s"}.`
      );
      clearQuickDraft(assignment.id);
      await load(false, true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to save this subject schedule.";
      setError(
        savedDays > 0 ? `${savedDays} day(s) saved before this issue: ${message} Review the current entries before retrying.` : message
      );
      await load(false, true);
    } finally {
      setWorking("");
    }
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
        if (!next[day]) {
          next[day] = { startTime: "", endTime: "", room: "" };
        }
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
    setAdvancedOpen(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function saveSchedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (working || loading) return;
    const assignment = lookup.assignmentsById.get(editAssignment);
    const periods = editId ? [{ id: editId, day_of_week: Number(editDay), start_time: editStart, end_time: editEnd, room: editRoom.trim().replace(/\s+/g, " ") || null }] :
      selectedDays.map((day) => ({ day_of_week: day, start_time: dayDrafts[day]?.startTime ?? "", end_time: dayDrafts[day]?.endTime ?? "", room: dayDrafts[day]?.room.trim().replace(/\s+/g, " ") || null }));
    if (periods.some((period) => !validSchoolTimeRange(period.start_time, period.end_time))) {
      setError("Class schedules must be between 7:30 AM and 4:30 PM.");
      return;
    }
    if (assignment && checkLocalConflicts(assignment, periods)) return;
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
        showServerConflict(result);
        setError(result.error ?? "Unable to save the schedule.");
        return;
      }

      setSuccess(
        editId
          ? "Schedule updated."
          : `${result.count ?? selectedDays.length} schedule entr${
              (result.count ?? selectedDays.length) === 1 ? "y" : "ies"
            } added.`
      );
      resetForm();
      await load(false, true);
    } catch {
      setError("Unable to reach the class schedule service.");
    } finally {
      setWorking("");
    }
  }

  async function setScheduleActive(schedule: Schedule, isActive: boolean) {
    if (working || loading) return;
    const assignment = lookup.assignmentsById.get(schedule.teacher_assignment_id);
    if (isActive && assignment && checkLocalConflicts(assignment, [schedule])) return;
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
        showServerConflict(result);
        setError(result.error ?? "Unable to update the schedule.");
        return;
      }

      setSuccess(`Schedule ${isActive ? "reactivated" : "deactivated"}.`);
      await load(false, true);
    } catch {
      setError("Unable to reach the class schedule service.");
    } finally {
      setWorking("");
    }
  }

  async function deleteSchedule(schedule: Schedule) {
    if (working || loading) return;

    const assignment = lookup.assignmentsById.get(schedule.teacher_assignment_id);
    const subject = assignment
      ? lookup.subjectsById.get(assignment.subject_id)?.name ?? "Subject"
      : "Subject";
    const section = assignment
      ? lookup.sectionsById.get(assignment.section_id) ?? "Unknown Section"
      : "Unknown Section";
    const teacher = assignment
      ? assignmentTeacherNames(assignment)
      : "Unknown Teacher";
    const day = DAYS.find((item) => item.value === schedule.day_of_week)?.label ?? "Selected Day";

    const confirmed = window.confirm(
      `Delete this schedule entry?\n\n${subject}\n${teacher}\nGrade ${assignment?.grade_level ?? ""} · ${section}\n${day}, ${timeLabel(schedule.start_time)}–${timeLabel(schedule.end_time)}\n\nThis removes only this day/time schedule. The Subject Teacher assignment will remain.`
    );
    if (!confirmed) return;

    setWorking(`delete:${schedule.id}`);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/admin/class-schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete_schedule",
          id: schedule.id,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(result.error ?? "Unable to delete the schedule entry.");
        return;
      }

      if (editId === schedule.id) {
        resetForm();
        setAdvancedOpen(false);
      }
      if (highlightId === schedule.id) setHighlightId("");

      setSchedules((current) =>
        current.filter((item) => item.id !== schedule.id)
      );
      setSuccess(`${subject} schedule deleted for ${day}.`);
      await load(false, true);
    } catch {
      setError("Unable to reach the class schedule service.");
    } finally {
      setWorking("");
    }
  }

  const orderedSchedules = [...schedules].sort((a, b) => {
    if (a.day_of_week !== b.day_of_week) {
      return a.day_of_week - b.day_of_week;
    }
    return a.start_time.localeCompare(b.start_time);
  });

  const visibleSchedules = roomFilter
    ? orderedSchedules.filter((schedule) => normalizedRoom(schedule.room) === normalizedRoom(roomFilter))
    : hasSelection
    ? orderedSchedules.filter((schedule) => {
        const assignment = lookup.assignmentsById.get(
          schedule.teacher_assignment_id
        );
        return teacherView
          ? Boolean(assignment && assignmentTeacherIds(assignment).includes(quickTeacher))
          : assignment?.section_id === quickSection;
      })
    : teacherView ? [] : orderedSchedules;

  const visibleScheduleBlocks = roomFilter || teacherView
    ? []
    : quickSection
      ? scheduleBlocks.filter((block) => block.section_id === quickSection && block.is_active)
      : scheduleBlocks.filter((block) => block.is_active);

  const visibleGrade7TveRotations = roomFilter
    ? []
    : teacherView
      ? quickTeacher
        ? grade7TveRotations.filter((rotation) => rotation.teacher_id === quickTeacher)
        : []
      : quickSection
        ? grade7TveRotations.filter((rotation) => rotation.section_id === quickSection)
        : grade7TveRotations;

  const visibleScheduleItems = [
    ...visibleSchedules.map((item) => ({
      kind: "schedule" as const,
      id: item.id,
      day_of_week: item.day_of_week,
      start_time: item.start_time,
      item,
    })),
    ...visibleScheduleBlocks.map((item) => ({
      kind: "block" as const,
      id: item.id,
      day_of_week: item.day_of_week,
      start_time: item.start_time,
      item,
    })),
    ...visibleGrade7TveRotations.flatMap((item) =>
      (item.days_of_week ?? []).map((day) => ({
        kind: "grade7tve" as const,
        id: `${item.id}-${day}`,
        day_of_week: Number(day),
        start_time: item.start_time,
        item,
      }))
    ),
  ].sort(
    (a, b) =>
      a.day_of_week - b.day_of_week ||
      a.start_time.localeCompare(b.start_time)
  );

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <nav className={styles.topActions}>
          <a href="/portal" className={styles.topLink}>
            <ArrowLeft size={16} /> Back to Portal
          </a>
          <a href="/portal/admin/teaching" className={styles.topLink}>
            Subjects & Teachers
          </a>
        </nav>

        <header className={styles.header}>
          <div>
            <span className={styles.eyebrow}>ADMINISTRATION</span>
            <h1>Class Schedules</h1>
            <p>
              Build schedules by section or one teacher at a time. Both views update
              the same class schedules. Teacher, section, and room conflicts remain
              blocked automatically.
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

        {error && <div className={styles.error} role="alert">{error}</div>}
        {success && <div className={styles.success} role="status">{success}</div>}

        {reviewOrigin && (
          <div className={styles.reviewBanner} role="status">
            <div><strong>Reviewing a Schedule Conflict</strong><p>The overlapping entry is highlighted below. Your unfinished entry is kept while you review.</p></div>
            <button type="button" className={styles.secondary} disabled={Boolean(working)} onClick={returnToDraft}>Return to My Entry</button>
          </div>
        )}

        <div className={styles.viewSwitcher} role="group" aria-label="Schedule View">
          <button type="button" aria-pressed={!teacherView} disabled={Boolean(working)} onClick={() => { setRoomFilter(""); changeView("section"); }}>
            By Section
          </button>
          <button type="button" aria-pressed={teacherView} disabled={Boolean(working)} onClick={() => { setRoomFilter(""); changeView("teacher"); }}>
            By Teacher
          </button>
        </div>

        <section className={`${styles.panel} ${styles.quickPanel}`}>
          <div className={styles.panelHeading}>
            <div>
              <div className={styles.quickTitle}>
                <WandSparkles size={18} />
                <span>RECOMMENDED</span>
              </div>
              <h2>{teacherView ? "Quick Teacher Schedule" : "Quick Section Schedule"}</h2>
              <p>
                {teacherView
                  ? "Choose a teacher to schedule their assigned subjects and sections. Select multiple days to apply the same time and room."
                  : "Choose a section once, then schedule each assigned subject directly from the list below."}
              </p>
            </div>
          </div>

          <div className={styles.quickPicker}>
            {teacherView ? (
              <label className={styles.teacherPicker}>
                <span>Teacher</span>
                <select value={quickTeacher} disabled={loading || Boolean(working)} onChange={(event) => {
                  setQuickTeacher(event.target.value);
                  setRoomFilter("");
                  setError("");
                  setSuccess("");
                }}>
                  <option value="">Select Teacher</option>
                  {teacherOptions.map((teacher) => (
                    <option key={teacher.id} value={teacher.id}>{teacher.full_name}</option>
                  ))}
                </select>
              </label>
            ) : <>
            <label>
              <span>Grade Level</span>
              <select
                value={quickGrade}
                disabled={loading || Boolean(working)}
                onChange={(event) => {
                  setQuickGrade(event.target.value);
                  setRoomFilter("");
                  setQuickSection("");
                  setError("");
                  setSuccess("");
                }}
              >
                <option value="">Select Grade Level</option>
                {gradeOptions.map((grade) => (
                  <option key={grade} value={grade}>
                    Grade {grade}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Section</span>
              <select
                value={quickSection}
                disabled={!quickGrade || loading || Boolean(working)}
                onChange={(event) => {
                  setQuickSection(event.target.value);
                  setRoomFilter("");
                  setError("");
                  setSuccess("");
                }}
              >
                <option value="">
                  {quickGrade ? "Select Section" : "Select Grade Level First"}
                </option>
                {quickSectionOptions.map((section) => (
                  <option key={section.id} value={section.id}>
                    {section.name}
                  </option>
                ))}
              </select>
            </label>
            </>}

            {hasSelection && (
              <div className={styles.quickSummary}>
                <strong>{quickAssignments.length}</strong>
                <span>Teaching Load{quickAssignments.length === 1 ? "" : "s"}</span>
                <small>
                  {quickSummary.scheduledLoads} scheduled · {quickAssignments.length - quickSummary.scheduledLoads} unscheduled
                  <br />{quickSummary.entries} active periods · {quickSummary.weeklyHours} hours/week
                </small>
              </div>
            )}
          </div>

          {loading ? <div className={styles.quickEmpty}>Loading teaching loads…</div> : !hasSelection ? (
            <div className={styles.quickEmpty}>
              <CalendarDays size={26} />
              <strong>{teacherView ? "Select a Teacher" : "Select a Grade Level and Section"}</strong>
              <span>{teacherView ? "All assigned subjects and sections will appear automatically." : "The assigned Subjects and Teachers will appear automatically."}</span>
            </div>
          ) : quickAssignments.length === 0 ? (
            <div className={styles.quickEmpty}>
              <CalendarDays size={26} />
              <strong>No Subject Teacher Assignments Yet</strong>
              <span>
                {teacherView ? "Assign this teacher's subjects and sections in Subjects & Teachers, then return here." : "Configure the section first in Subjects & Teachers, then return here."}
              </span>
            </div>
          ) : (
            <div className={styles.quickRows}>
              {quickAssignments.map((assignment) => {
                const draft =
                  quickDrafts[assignment.id] ?? emptyQuickDraft();
                const subject =
                  lookup.subjectsById.get(assignment.subject_id)?.name ??
                  "Unknown Subject";
                const teacher = assignmentTeacherNames(assignment);
                const existing = schedulesForAssignment(assignment.id);
                const quickWorking = working === `quick:${assignment.id}`;

                return (
                  <article
                    id={`quick-assignment-${assignment.id}`}
                    tabIndex={-1}
                    className={`${styles.quickRow} ${attentionAssignmentId === assignment.id ? styles.attentionRow : ""}`}
                    key={assignment.id}
                  >
                    <div className={styles.quickSubject}>
                      <span>SUBJECT</span>
                      <strong>{subject}</strong>
                      {assignment.major && <small>{assignment.major}</small>}
                      {teacherView && <small>Grade {assignment.grade_level} · {lookup.sectionsById.get(assignment.section_id) ?? "Unknown Section"}</small>}
                      <p>{teacherView ? (existing.length ? "Scheduled" : "Not Scheduled Yet") : teacher}</p>
                      {attentionAssignmentId === assignment.id && (
                        <small className={styles.attentionLabel}>Needs Class Schedule</small>
                      )}
                    </div>

                    <div className={styles.quickDays}>
                      <div className={styles.quickFieldLabel}>
                        <span>Days</span>
                        <button
                          type="button"
                          onClick={() => setQuickWeekdays(assignment.id)}
                        >
                          Mon–Fri
                        </button>
                      </div>
                      <div className={styles.quickDayChoices}>
                        {WEEKDAYS.map((day) => {
                          const selected = draft.days.includes(day.value);
                          return (
                            <button
                              key={day.value}
                              type="button"
                              className={
                                selected
                                  ? styles.quickDaySelected
                                  : styles.quickDayChoice
                              }
                              onClick={() =>
                                toggleQuickDay(assignment.id, day.value)
                              }
                              aria-pressed={selected}
                            >
                              {day.short}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <label className={styles.quickTime}>
                      <span>Start</span>
                      <input
                        type="time"
                        min={SCHOOL_DAY_START}
                        max={SCHOOL_DAY_END}
                        value={draft.startTime}
                        onChange={(event) =>
                          updateQuickDraft(
                            assignment.id,
                            "startTime",
                            event.target.value
                          )
                        }
                      />
                    </label>

                    <label className={styles.quickTime}>
                      <span>End</span>
                      <input
                        type="time"
                        min={SCHOOL_DAY_START}
                        max={SCHOOL_DAY_END}
                        value={draft.endTime}
                        onChange={(event) =>
                          updateQuickDraft(
                            assignment.id,
                            "endTime",
                            event.target.value
                          )
                        }
                      />
                    </label>

                    <label className={styles.quickRoom}>
                      <span>Room <small>optional</small></span>
                      <input
                        maxLength={80}
                        placeholder="Room / Location"
                        value={draft.room}
                        onChange={(event) =>
                          updateQuickDraft(
                            assignment.id,
                            "room",
                            event.target.value
                          )
                        }
                      />
                    </label>

                    <div className={styles.quickSave}>
                      <button
                        type="button"
                        disabled={
                          Boolean(working) || loading ||
                          !draft.days.length ||
                          !draft.startTime ||
                          !draft.endTime
                        }
                        onClick={() => void saveQuickAssignment(assignment)}
                      >
                        <Save size={15} />
                        {quickWorking ? "Saving…" : "Save"}
                      </button>
                    </div>

                    {existing.length > 0 && (
                      <div className={styles.quickExisting}>
                        <span>Current:</span>
                        {existing.map((schedule) => (
                          <span className={styles.quickExistingEntry} key={schedule.id}>
                            <button
                              type="button"
                              className={styles.quickExistingEdit}
                              onClick={() => startEdit(schedule)}
                              title="Edit this schedule entry"
                            >
                              <strong>
                                {DAYS.find(
                                  (day) => day.value === schedule.day_of_week
                                )?.short}
                              </strong>
                              {timeLabel(schedule.start_time)}–
                              {timeLabel(schedule.end_time)}
                              {schedule.room ? ` · ${schedule.room}` : ""}
                            </button>
                            <button
                              type="button"
                              className={styles.quickExistingDelete}
                              disabled={Boolean(working) || loading}
                              onClick={() => void deleteSchedule(schedule)}
                              title="Delete this schedule entry"
                              aria-label={`Delete ${DAYS.find((day) => day.value === schedule.day_of_week)?.label ?? "schedule"} entry`}
                            >
                              <Trash2 size={13} />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <details
          className={styles.advancedPanel}
          open={advancedOpen}
          onToggle={(event) =>
            setAdvancedOpen((event.currentTarget as HTMLDetailsElement).open)
          }
        >
          <summary>
            <div>
              <strong>
                {editId ? "Editing Schedule Entry" : "Advanced Schedule Entry"}
              </strong>
              <span>
                Use this only when one subject needs different times on different
                days or weekend scheduling.
              </span>
            </div>
            <span>{editId ? "Editing" : "Optional"}</span>
          </summary>

          <div className={styles.advancedBody}>
            <div className={styles.panelHeading}>
              <div>
                <h2>{editId ? "Edit Schedule" : "Add Advanced Schedule"}</h2>
                <p>
                  Select any active Teacher assignment and configure each day
                  separately.
                </p>
              </div>
              {editId && (
                <button
                  type="button"
                  className={styles.secondary}
                  onClick={() => {
                    resetForm();
                    setAdvancedOpen(false);
                  }}
                >
                  Cancel Edit
                </button>
              )}
            </div>

            <form className={styles.form} onSubmit={saveSchedule}>
              <label className={styles.assignmentField}>
                <span>Class Assignment</span>
                <select
                  required
                  value={editAssignment}
                  onChange={(event) => setEditAssignment(event.target.value)}
                >
                  <option value="">Select Class Assignment</option>
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
                      <option value="">Select Day</option>
                      {DAYS.map((day) => (
                        <option key={day.value} value={day.value}>
                          {day.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    <span>Start Time</span>
                    <input
                      required
                      type="time"
                      min={SCHOOL_DAY_START}
                      max={SCHOOL_DAY_END}
                      value={editStart}
                      onChange={(event) => setEditStart(event.target.value)}
                    />
                  </label>

                  <label>
                    <span>End Time</span>
                    <input
                      required
                      type="time"
                      min={SCHOOL_DAY_START}
                      max={SCHOOL_DAY_END}
                      value={editEnd}
                      onChange={(event) => setEditEnd(event.target.value)}
                    />
                  </label>

                  <label>
                    <span>
                      Room / Location <small>optional</small>
                    </span>
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
                        <span>Teaching Days</span>
                        <small>
                          Select every day this class meets. Each day can have a
                          different time and room.
                        </small>
                      </div>
                      <div className={styles.dayHelpers}>
                        <button
                          type="button"
                          className={styles.secondary}
                          onClick={selectWeekdays}
                        >
                          Select Monday–Friday
                        </button>
                        <button
                          type="button"
                          className={styles.secondary}
                          onClick={clearDays}
                        >
                          Clear Days
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
                            className={
                              selected
                                ? styles.daySelected
                                : styles.dayChoice
                            }
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
                        <span>Start Time</span>
                        <span>End Time</span>
                        <span>Room / Location</span>
                      </div>

                      {selectedDays.map((day) => {
                        const dayInfo = DAYS.find(
                          (item) => item.value === day
                        );
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
                              min={SCHOOL_DAY_START}
                              max={SCHOOL_DAY_END}
                              aria-label={`${dayInfo?.label} start time`}
                              value={draft.startTime}
                              onChange={(event) =>
                                updateDayDraft(
                                  day,
                                  "startTime",
                                  event.target.value
                                )
                              }
                            />
                            <input
                              required
                              type="time"
                              min={SCHOOL_DAY_START}
                              max={SCHOOL_DAY_END}
                              aria-label={`${dayInfo?.label} end time`}
                              value={draft.endTime}
                              onChange={(event) =>
                                updateDayDraft(
                                  day,
                                  "endTime",
                                  event.target.value
                                )
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
                    Boolean(working) || loading ||
                    assignments.length === 0 ||
                    (!editId && selectedDays.length === 0)
                  }
                >
                  {editId ? <Pencil size={17} /> : <Plus size={17} />}
                  {working === "save"
                    ? "Saving…"
                    : editId
                      ? "Update Schedule"
                      : selectedDays.length > 1
                        ? `Add ${selectedDays.length} Schedule Entries`
                        : "Add Schedule"}
                </button>
              </div>
            </form>
          </div>
        </details>

        <section className={styles.panel}>
          <div className={styles.panelHeading}>
            <div>
              <h2>
                {roomFilter ? `Room Schedule: ${roomFilter}` : teacherView ? "Selected Teacher Schedule" : quickSection ? "Selected Section Schedule" : "Published Class Schedule"}
              </h2>
              <p>
                Active entries appear automatically in Student and Teacher
                dashboards.
              </p>
            </div>
            <button
              className={styles.secondary}
              onClick={() => void load()}
              disabled={loading || Boolean(working)}
            >
              <RefreshCw size={16} /> Refresh
            </button>
          </div>

          {loading ? (
            <div className={styles.empty}>Loading schedules…</div>
          ) : visibleScheduleItems.length === 0 ? (
            <div className={styles.empty}>
              <CalendarDays size={30} />
              <strong>No Class Schedules Yet</strong>
              <span>
                {teacherView
                  ? "Choose a teacher above and schedule their assigned teaching loads."
                  : quickSection ? "Use Quick Section Schedule above to add this section."
                    : "Choose a section above to start building schedules."}
              </span>
            </div>
          ) : (
            <div className={styles.scheduleList}>
              {visibleScheduleItems.map((entry) => {
                if (entry.kind === "grade7tve") {
                  const rotation = entry.item;
                  return (
                    <article key={`g7-tve-${entry.id}`} className={`${styles.scheduleRow} ${styles.scheduleTveRow}`}>
                      <div className={styles.dayBox}>
                        <CalendarDays size={18} />
                        <strong>{DAYS.find((day) => day.value === entry.day_of_week)?.label}</strong>
                      </div>

                      <div>
                        <span>CLASS</span>
                        <strong>
                          Grade 7 · {rotation.section_id
                            ? lookup.sectionsById.get(rotation.section_id) ?? rotation.group_label
                            : `${rotation.group_label} Group`}
                        </strong>
                        <small>Technical Vocational Education · {grade7TveMajorLabel(rotation.major_code)}</small>
                      </div>

                      <div>
                        <span>INSTRUCTOR</span>
                        <strong>{rotation.instructor_name}</strong>
                        <small>Exploratory TVE · Rotation {rotation.phase_no}</small>
                      </div>

                      <div>
                        <span>TIME & PERIOD</span>
                        <strong className={styles.inline}>
                          <Clock3 size={15} />
                          {timeLabel(rotation.start_time)} – {timeLabel(rotation.end_time)}
                        </strong>
                        <small>{rotation.starts_on} to {rotation.ends_on}</small>
                      </div>

                      <div className={styles.blockStatus}>
                        <span>ROTATION</span>
                      </div>
                    </article>
                  );
                }

                if (entry.kind === "block") {
                  const block = entry.item;
                  return (
                    <article key={`block-${block.id}`} className={`${styles.scheduleRow} ${styles.scheduleBlockRow}`}>
                      <div className={styles.dayBox}>
                        <CalendarDays size={18} />
                        <strong>{DAYS.find((day) => day.value === block.day_of_week)?.label}</strong>
                      </div>

                      <div>
                        <span>CLASS</span>
                        <strong>
                          Grade {block.grade_level} · {lookup.sectionsById.get(block.section_id) ?? "Unknown"}
                        </strong>
                        <small>{block.label}</small>
                      </div>

                      <div>
                        <span>TYPE</span>
                        <strong>Non-Instructional</strong>
                        <small>{block.purpose || "Reserved period"}</small>
                      </div>

                      <div>
                        <span>TIME</span>
                        <strong className={styles.inline}>
                          <Clock3 size={15} />
                          {timeLabel(block.start_time)} – {timeLabel(block.end_time)}
                        </strong>
                        <small className={styles.inline}>
                          <MapPin size={14} />
                          Section cleaning / upkeep
                        </small>
                      </div>

                      <div className={styles.blockStatus}>
                        <span>RESERVED</span>
                      </div>
                    </article>
                  );
                }

                const schedule = entry.item;
                const assignment = lookup.assignmentsById.get(
                  schedule.teacher_assignment_id
                );
                const subject = assignment
                  ? lookup.subjectsById.get(assignment.subject_id)
                  : null;

                return (
                  <article key={schedule.id} id={`schedule-${schedule.id}`} tabIndex={-1} className={`${styles.scheduleRow} ${highlightId === schedule.id ? styles.conflictHighlight : ""}`}>
                    <div className={styles.dayBox}>
                      <CalendarDays size={18} />
                      <strong>
                        {DAYS.find((day) => day.value === schedule.day_of_week)?.label}
                      </strong>
                    </div>

                    <div>
                      <span>CLASS</span>
                      <strong>
                        {assignment
                          ? `Grade ${assignment.grade_level} · ${
                              lookup.sectionsById.get(assignment.section_id) ??
                              "Unknown"
                            }`
                          : "Unknown class"}
                      </strong>
                      <small>
                        {subject?.name ?? "Unknown subject"}
                        {assignment?.major ? ` · ${assignment.major}` : ""}
                      </small>
                      {highlightId === schedule.id && <small className={styles.conflictLabel}>Overlapping Entry</small>}
                    </div>

                    <div>
                      <span>TEACHER</span>
                      <strong>
                        {assignment
                          ? assignmentTeacherNames(assignment)
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
                      <button
                        className={styles.edit}
                        disabled={Boolean(working)}
                        onClick={() => startEdit(schedule)}
                      >
                        <Pencil size={15} /> Edit
                      </button>
                      <button
                        className={styles.delete}
                        disabled={Boolean(working) || loading}
                        onClick={() => void deleteSchedule(schedule)}
                      >
                        <Trash2 size={15} />
                        {working === `delete:${schedule.id}` ? "Deleting…" : "Delete"}
                      </button>
                      <button
                        className={
                          schedule.is_active ? styles.active : styles.inactive
                        }
                        disabled={Boolean(working) || loading}
                        onClick={() =>
                          void setScheduleActive(
                            schedule,
                            !schedule.is_active
                          )
                        }
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
        {conflictDialog && (
          <dialog ref={dialogRef} className={styles.conflictDialog} aria-labelledby="schedule-conflict-title" aria-describedby="schedule-conflict-description" onCancel={closeConflictDialog}>
            <div className={styles.conflictDialogHeading}>
              <AlertTriangle size={25} aria-hidden="true" />
              <h2 id="schedule-conflict-title" tabIndex={-1}>Schedule Conflict</h2>
            </div>
            <p id="schedule-conflict-description">{conflictDialog.message}</p>
            <div className={styles.conflictDetails}>
              {conflictDialog.conflicts.map((conflict) => (
                <article key={conflict.schedule.id}>
                  <span>{conflict.kinds.map((kind) => kind[0].toUpperCase() + kind.slice(1)).join(" / ")} Conflict</span>
                  <h3>{conflict.teacherName}</h3>
                  <p>{conflict.subjectName}{conflict.assignment.major ? ` · ${conflict.assignment.major}` : ""}</p>
                  <p>Grade {conflict.assignment.grade_level} · {conflict.sectionName}</p>
                  <strong>{DAYS.find((day) => day.value === conflict.schedule.day_of_week)?.label}, {timeLabel(conflict.schedule.start_time)}–{timeLabel(conflict.schedule.end_time)}</strong>
                  <p>Room: {conflict.schedule.room || "Not Specified"}</p>
                  <div className={styles.conflictButtons}>
                    {conflict.kinds.map((kind) => (
                      <button key={kind} type="button" className={styles.secondary} disabled={loading || Boolean(working)} onClick={() => reviewConflict(conflict, kind)}>
                        View {kind === "teacher" ? "Teacher’s" : kind === "section" ? "Section" : "Room"} Schedule
                      </button>
                    ))}
                  </div>
                </article>
              ))}
            </div>
            <div className={styles.conflictDialogFooter}>
              <small>Your unfinished input stays on this page.</small>
              <button type="button" className={styles.secondary} onClick={closeConflictDialog}>Change Time / Close</button>
            </div>
          </dialog>
        )}
      </div>
    </main>
  );
}
