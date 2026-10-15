/** Grade-aware class schedule time limits, shared by the regular JHS/SHS scheduler. */
export const SCHOOL_DAY_START = "07:30";
export const JUNIOR_HIGH_DAY_END = "16:30";
export const SENIOR_HIGH_DAY_END = "16:45";

export function schoolDayEnd(gradeLevel: number | null | undefined): string {
  return Number(gradeLevel) >= 11 && Number(gradeLevel) <= 12
    ? SENIOR_HIGH_DAY_END
    : JUNIOR_HIGH_DAY_END;
}

export function validSchoolTimeRange(
  startTime: string,
  endTime: string,
  gradeLevel: number | null | undefined
): boolean {
  const hhmm = /^([01]\d|2[0-3]):[0-5]\d$/;
  return hhmm.test(startTime) &&
    hhmm.test(endTime) &&
    startTime >= SCHOOL_DAY_START &&
    endTime <= schoolDayEnd(gradeLevel) &&
    startTime < endTime;
}

export function schoolHoursError(gradeLevel: number | null | undefined): string {
  return `Grade ${gradeLevel ?? "7–10"} classes must be scheduled between 7:30 AM and ${schoolDayEnd(gradeLevel) === SENIOR_HIGH_DAY_END ? "4:45 PM" : "4:30 PM"}.`;
}
