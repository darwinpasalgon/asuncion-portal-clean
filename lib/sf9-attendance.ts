/**
 * SF9 monthly attendance uses the official school-day calendar and actual
 * per-learner entries. Missing records are NEVER inferred to be absences.
 * Dates are Manila-local YYYY-MM-DD strings; UTC noon avoids DST/timezone drift.
 */
export const SF9_MONTHS = [
  { key: "Jun", month: 6 }, { key: "Jul", month: 7 },
  { key: "Aug", month: 8 }, { key: "Sep", month: 9 },
  { key: "Oct", month: 10 }, { key: "Nov", month: 11 },
  { key: "Dec", month: 12 }, { key: "Jan", month: 1 },
  { key: "Feb", month: 2 }, { key: "Mar", month: 3 },
  { key: "Apr", month: 4 },
] as const;

export type Sf9AttendanceEntry = { attendance_date: string; status: string | null };

export function sf9AttendanceValue(status: string | null | undefined): { present: number; absent: number } | null {
  const value = String(status ?? "").toLowerCase().trim();
  if (value === "present") return { present: 1, absent: 0 };
  if (value === "absent") return { present: 0, absent: 1 };
  if (value === "absent_morning" || value === "absent_afternoon")
    return { present: 0.5, absent: 0.5 };
  // SF2 treats cutting classes as a recorded present learner with a conduct/tardy flag.
  // Do not invent a full-day absence when the recorded status has no absent duration.
  if (value === "cutting_classes") return { present: 1, absent: 0 };
  // Transfer, dropped and other movement statuses do not supply presence/absence.
  return null;
}

export function sf9MonthKey(date: string, startYear: number): string | null {
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  if (!Number.isInteger(startYear) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  if (year !== (month >= 6 ? startYear : startYear + 1)) return null;
  return SF9_MONTHS.find(item => item.month === month)?.key ?? null;
}

export function sf9InstructionalDates(input: {
  startDate: string; currentDate: string; startYear: number; excludedDates: Iterable<string>;
}) {
  const end = `${input.startYear + 1}-04-30`;
  const cutoff = input.currentDate < end ? input.currentDate : end;
  const start = input.startDate;
  const exclusions = new Set(input.excludedDates);
  const days: string[] = [];
  if (cutoff < start) return days;
  const beginDate = new Date(`${start}T12:00:00Z`);
  const cutoffDate = new Date(`${cutoff}T12:00:00Z`);
  if (Number.isNaN(beginDate.getTime()) || Number.isNaN(cutoffDate.getTime())) return days;
  for (const current = new Date(beginDate); current <= cutoffDate; current.setUTCDate(current.getUTCDate() + 1)) {
    const weekday = current.getUTCDay();
    if (weekday < 1 || weekday > 5) continue;
    const date = current.toISOString().slice(0, 10);
    if (!exclusions.has(date) && sf9MonthKey(date, input.startYear)) days.push(date);
  }
  return days;
}

export function sf9AttendanceSummary(input: {
  classDates: Iterable<string>; studentEntries: Iterable<Sf9AttendanceEntry>; startYear: number;
}) {
  const months = SF9_MONTHS.map(m => m.key);
  const totals = () => Object.fromEntries(months.map(key => [key, 0])) as Record<string, number>;
  const classDays = totals(), present = totals(), absent = totals(), recorded = totals();
  const classDateSet = new Set(input.classDates);
  const validDates = [...classDateSet].filter(date => Boolean(sf9MonthKey(date, input.startYear)));
  for (const date of validDates) classDays[sf9MonthKey(date, input.startYear)!]++;
  const statusByDate = new Map<string, { present: number; absent: number }>();
  for (const row of input.studentEntries) {
    const date = String(row.attendance_date ?? "");
    if (!classDateSet.has(date)) continue;
    const value = sf9AttendanceValue(row.status);
    // A later correction to a status supersedes the previous entry for this day.
    if (value) statusByDate.set(date, value);
  }
  for (const [date, value] of statusByDate) {
    const key = sf9MonthKey(date, input.startYear);
    if (!key) continue;
    recorded[key] += 1;
    present[key] += value.present;
    absent[key] += value.absent;
  }
  const unrecorded = totals();
  for (const key of months) unrecorded[key] = Math.max(0, classDays[key] - recorded[key]);
  const sum = (values: Record<string, number>) => Object.values(values).reduce((a, b) => a + b, 0);
  return {
    months, class_days: classDays, days_present: present, days_absent: absent,
    recorded_days: recorded, unrecorded_days: unrecorded,
    total_class_days: sum(classDays), total_present: sum(present),
    total_absent: sum(absent), total_recorded: sum(recorded), total_unrecorded: sum(unrecorded),
  };
}
