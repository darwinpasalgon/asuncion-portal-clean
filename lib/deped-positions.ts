export const teachingPositions = [
  "TEACHER I",
  "TEACHER II",
  "TEACHER III",
  "TEACHER IV",
  "TEACHER V",
  "TEACHER VI",
  "TEACHER VII",
  "MASTER TEACHER I",
  "MASTER TEACHER II",
  "MASTER TEACHER III",
  "MASTER TEACHER IV",
  "MASTER TEACHER V",
] as const;

export const nonTeachingPositions = [
  "ADMINISTRATIVE OFFICER I",
  "ADMINISTRATIVE OFFICER II",
  "ADMINISTRATIVE OFFICER III",
  "ADMINISTRATIVE OFFICER IV",
  "ADMINISTRATIVE OFFICER V",
  "HEAD TEACHER I",
  "HEAD TEACHER II",
  "HEAD TEACHER III",
  "HEAD TEACHER IV",
  "PRINCIPAL I",
  "PRINCIPAL II",
  "PRINCIPAL III",
  "PRINCIPAL IV",
  "PROJECT DEVELOPMENT OFFICER I",
  "PROJECT DEVELOPMENT OFFICER II",
  "ADMINISTRATIVE ASSISTANT I",
  "ADMINISTRATIVE ASSISTANT II",
  "ADMINISTRATIVE ASSISTANT III",
  "REGISTRAR",
] as const;

export function positionOptions(
  positions: readonly string[],
  current?: string | null
) {
  const normalized = String(current ?? "").trim().toUpperCase();
  if (!normalized || positions.includes(normalized)) return [...positions];
  return [normalized, ...positions];
}
