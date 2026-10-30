export type TeacherActivity = {
  id: string;
  full_name: string;
  email: string;
  position: string;
  last_sign_in_at: string | null;
  last_seen_at: string | null;
  active_days_30: number;
  active_days_7: number;
};
export type ActivityStatus = "active" | "opened" | "never";
export function activityStatus(row: TeacherActivity): ActivityStatus {
  if (!row.last_sign_in_at && !row.last_seen_at) return "never";
  return row.active_days_30 >= 3 && row.active_days_7 >= 1 ? "active" : "opened";
}
export const activityLabels: Record<ActivityStatus, string> = {
  active: "Active recently",
  opened: "Has logged in",
  never: "Never logged in",
};
