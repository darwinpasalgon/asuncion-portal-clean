export type ConflictAssignment = {
  id: string;
  teacher_id: string;
  section_id: string;
  subject_id: string;
  grade_level: number;
  major: string | null;
};

export type ConflictSchedule = {
  id: string;
  teacher_assignment_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  room: string | null;
  is_active: boolean;
};

export type ProposedPeriod = {
  id?: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  room: string | null;
};

export type ScheduleConflict = {
  schedule: ConflictSchedule;
  assignment: ConflictAssignment;
  kinds: Array<"teacher" | "section" | "room">;
  teacherName: string;
  sectionName: string;
  subjectName: string;
};

export function normalizedRoom(room: string | null) {
  return (room ?? "").trim().toLowerCase();
}

// Match private.validate_class_schedule, including its distinct TVE-major exception.
// The database remains authoritative for writes and concurrent changes.
export function findScheduleConflicts(
  assignment: ConflictAssignment,
  periods: ProposedPeriod[],
  data: {
    assignments: ConflictAssignment[];
    schedules: ConflictSchedule[];
    teachers: Array<{ id: string; full_name: string }>;
    sections: Array<{ id: string; name: string }>;
    subjects: Array<{ id: string; name: string }>;
  }
): ScheduleConflict[] {
  const assignments = new Map(data.assignments.map((item) => [item.id, item]));
  const teachers = new Map(data.teachers.map((item) => [item.id, item.full_name]));
  const sections = new Map(data.sections.map((item) => [item.id, item.name]));
  const subjects = new Map(data.subjects.map((item) => [item.id, item.name]));
  const conflicts: ScheduleConflict[] = [];

  for (const schedule of data.schedules) {
    const other = assignments.get(schedule.teacher_assignment_id);
    if (!schedule.is_active || !other) continue;
    const kinds = new Set<"teacher" | "section" | "room">();
    for (const period of periods) {
      if (schedule.id === period.id || schedule.day_of_week !== period.day_of_week ||
          schedule.start_time.slice(0, 5) >= period.end_time.slice(0, 5) ||
          schedule.end_time.slice(0, 5) <= period.start_time.slice(0, 5)) continue;
      if (other.teacher_id === assignment.teacher_id) kinds.add("teacher");
      const separateMajors = assignment.major !== null && other.major !== null &&
        assignment.subject_id === other.subject_id && assignment.major !== other.major;
      if (other.section_id === assignment.section_id && !separateMajors) kinds.add("section");
      if (normalizedRoom(period.room) && normalizedRoom(schedule.room) === normalizedRoom(period.room)) {
        kinds.add("room");
      }
    }
    if (kinds.size) conflicts.push({
      schedule, assignment: other, kinds: [...kinds],
      teacherName: teachers.get(other.teacher_id) ?? "Assigned Teacher",
      sectionName: sections.get(other.section_id) ?? "Assigned Section",
      subjectName: subjects.get(other.subject_id) ?? "Assigned Subject",
    });
  }
  return conflicts.sort((a, b) => a.schedule.day_of_week - b.schedule.day_of_week ||
    a.schedule.start_time.localeCompare(b.schedule.start_time));
}
