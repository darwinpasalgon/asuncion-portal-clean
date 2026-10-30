export function gradeLabel(grade: number | null | undefined) {
  return grade === 0 ? "ALS A&E" : grade == null ? "" : `Grade ${grade}`;
}
