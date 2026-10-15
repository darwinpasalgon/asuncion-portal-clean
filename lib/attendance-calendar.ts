/** Official first school day for ANHS SY 2026–2027.
 * Other years must not inherit the 2026 opening date.
 */
export const ANHS_2026_OPENING_DAY = "2026-06-08";

export function attendanceStartDate(year: { start_year?: number | null } | null | undefined): string {
  if (!year?.start_year) return ANHS_2026_OPENING_DAY;
  return Number(year.start_year) === 2026
    ? ANHS_2026_OPENING_DAY
    : `${year.start_year}-06-01`;
}

/** Year-month list is limited to the current Manila calendar month. */
export function attendanceMonths(startDate: string, through: string): string[] {
  const first = startDate.slice(0, 7);
  const last = through.slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(first) || !/^\d{4}-\d{2}$/.test(last) || first > last) return [];
  const months: string[] = [];
  const [startYear, startMonth] = first.split("-").map(Number);
  const [endYear, endMonth] = last.split("-").map(Number);
  for (let year = startYear, month = startMonth; year < endYear || (year === endYear && month <= endMonth); ) {
    months.push(`${year}-${String(month).padStart(2, "0")}`);
    month++;
    if (month > 12) { year++; month = 1; }
  }
  return months;
}

export function attendanceMonthRange(month: string, startDate: string, today: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || month < startDate.slice(0, 7) || month > today.slice(0, 7)) {
    return null;
  }
  const [year, mon] = month.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, mon, 0, 12)).toISOString().slice(0, 10);
  return {
    start: `${month}-01` < startDate ? startDate : `${month}-01`,
    end: lastDay > today ? today : lastDay,
  };
}
