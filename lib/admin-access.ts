import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase-config";

export type AdminPermission =
  | "accounts.manage"
  | "users.manage"
  | "bulk_import.manage"
  | "school_setup.manage"
  | "teaching.manage"
  | "schedules.manage"
  | "attendance.manage"
  | "reports.view"
  | "announcements.manage"
  | "resources.manage"
  | "password_resets.manage"
  | "sf10.manage"
  | "hr.manage";

function headers(token: string) {
  return {
    apikey: SUPABASE_PUBLISHABLE_KEY,
    Authorization: `Bearer ${token}`,
  };
}

async function currentProfile(token: string) {
  const userResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: headers(token),
    cache: "no-store",
  });
  if (!userResponse.ok) return null;

  const user = await userResponse.json().catch(() => null);
  const id = String(user?.id ?? "");
  if (!id) return null;

  const profileResponse = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(
      id
    )}&select=id,role,account_status,admin_role&limit=1`,
    { headers: headers(token), cache: "no-store" }
  );
  if (!profileResponse.ok) return null;

  const rows = await profileResponse.json().catch(() => []);
  return rows?.[0] ?? null;
}

export async function hasAdminPermission(
  token: string,
  permission: AdminPermission
) {
  if (!token) return false;
  const profile = await currentProfile(token);
  if (!profile || profile.account_status !== "active") return false;

  if (profile.role === "administrator") return true;
  if (profile.role !== "staff_administrator") return false;

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/administrator_permissions?administrator_id=eq.${encodeURIComponent(
      profile.id
    )}&permission=eq.${encodeURIComponent(permission)}&select=permission&limit=1`,
    { headers: headers(token), cache: "no-store" }
  );
  if (!response.ok) return false;

  const rows = await response.json().catch(() => []);
  return Boolean(rows?.[0]);
}

export type GradeLevelHeadScope = {
  gradeLevel: number;
  displayName: string;
};

export async function getGradeLevelHeadScope(
  token: string
): Promise<GradeLevelHeadScope | null> {
  if (!token) return null;
  const profile = await currentProfile(token);
  if (!profile || profile.account_status !== "active") return null;

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/grade_level_heads?profile_id=eq.${encodeURIComponent(
      profile.id
    )}&is_active=eq.true&select=grade_level,display_name&limit=1`,
    { headers: headers(token), cache: "no-store" }
  );
  if (!response.ok) return null;

  const rows = await response.json().catch(() => []);
  const row = rows?.[0];
  const gradeLevel = Number(row?.grade_level ?? 0);
  if (!Number.isInteger(gradeLevel) || gradeLevel < 7 || gradeLevel > 12) {
    return null;
  }

  return {
    gradeLevel,
    displayName: String(row?.display_name ?? profile.full_name ?? "").trim(),
  };
}

export async function getScopedAdminAccess(
  token: string,
  permission: AdminPermission
): Promise<{ allowed: boolean; gradeLevel: number | null; gradeLevelHead: boolean }> {
  if (await hasAdminPermission(token, permission)) {
    return { allowed: true, gradeLevel: null, gradeLevelHead: false };
  }

  if (
    !["schedules.manage", "attendance.manage", "reports.view", "announcements.manage"].includes(
      permission
    )
  ) {
    return { allowed: false, gradeLevel: null, gradeLevelHead: false };
  }

  const scope = await getGradeLevelHeadScope(token);
  if (!scope) {
    return { allowed: false, gradeLevel: null, gradeLevelHead: false };
  }

  return {
    allowed: true,
    gradeLevel: scope.gradeLevel,
    gradeLevelHead: true,
  };
}

export async function isSuperAdministrator(token: string) {
  if (!token) return false;
  const profile = await currentProfile(token);
  return Boolean(
    profile &&
      profile.role === "administrator" &&
      profile.account_status === "active" &&
      profile.admin_role === "super_administrator"
  );
}
