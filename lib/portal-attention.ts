export type AttentionRole = "student" | "teacher" | "administrator" | "staff_administrator";
export type PersonnelAttentionPerson = {
  id: string; portal_user_id?: string | null; full_name: string; email?: string | null;
  position?: string | null; personnel_type: "teaching" | "non_teaching"; missing_fields: string[];
};
export type PersonnelProfileAttention = {
  self: { personnel_type: "teaching" | "non_teaching"; full_name?: string; missing_fields: string[]; complete: boolean } | null;
  can_manage: boolean; incomplete_teaching: PersonnelAttentionPerson[]; incomplete_non_teaching: PersonnelAttentionPerson[];
  teaching_count: number; non_teaching_count: number; total_incomplete: number;
};
export type AdviserAttentionLearner = {
  studentId: string; fullName: string; lrn: string | null; gradeLevel: number; section: string; missingFields: string[]; href: string;
};
export type AdviserAttentionAlert = {
  id: string; severity: "warning" | "info"; title: string; detail: string; count: number;
  href: string | null; actionLabel: string | null; administratorAction: boolean; learners?: AdviserAttentionLearner[];
};
export type AdviserAttention = { schoolDate?: string; isSchoolWeekday?: boolean; alerts: AdviserAttentionAlert[]; totalAlertTypes: number };
export type PortalAttentionData = { personnel: PersonnelProfileAttention | null; adviser: AdviserAttention | null; error: boolean };
export type AttentionScope = { role: AttentionRole; isAdviser: boolean };
export type PortalNotification = {
  id: string; kind: "profile" | "adviser" | "personnel" | "message"; title: string; detail: string; href: string | null; count: number; featureId: string;
};

export function safePortalHref(value: unknown): string | null {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return null;
  try {
    const url = new URL(value, "https://portal.invalid");
    return url.origin === "https://portal.invalid" && (url.pathname === "/portal" || url.pathname.startsWith("/portal/"))
      ? url.pathname + url.search + url.hash : null;
  } catch { return null; }
}
const positive = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;

export function buildPortalNotifications(
  scope: AttentionScope,
  data: PortalAttentionData,
  communityUnread: number,
  featureHrefs: string[],
): PortalNotification[] {
  const items: PortalNotification[] = [];
  const canOpen = (href: string) => featureHrefs.some(value => value.split("?")[0] === href);
  if (scope.role !== "student") {
    const p = data.personnel;
    const missing = (p?.self?.missing_fields ?? []).filter(value => typeof value === "string" && value.trim());
    if (missing.length && canOpen("/portal/teacher-profile")) items.push({
      id: "own-personnel-profile", kind: "profile", title: "Complete your personnel profile",
      detail: missing.slice(0, 3).join(", ") + (missing.length > 3 ? " and " + (missing.length - 3) + " more details." : "."),
      href: "/portal/teacher-profile", count: missing.length, featureId: "personnel-profile",
    });
    if (scope.role === "teacher" && scope.isAdviser) {
      const seen = new Set<string>();
      for (const alert of data.adviser?.alerts ?? []) {
        if (!alert.id || seen.has(alert.id)) continue;
        seen.add(alert.id);
        items.push({ id: "adviser-" + alert.id, kind: "adviser", title: alert.title, detail: alert.detail,
          href: safePortalHref(alert.href), count: positive(alert.count), featureId: "advisory" });
      }
    }
    if (p?.can_manage && positive(p.teaching_count) && canOpen("/portal/admin/teacher-profiles")) items.push({
      id: "teaching-profiles", kind: "personnel", title: "Teaching profiles need an update",
      detail: p.teaching_count + " personnel profile" + (p.teaching_count === 1 ? "" : "s") + " with missing required information.",
      href: "/portal/admin/teacher-profiles", count: positive(p.teaching_count), featureId: "teachers",
    });
    if (p?.can_manage && positive(p.non_teaching_count) && canOpen("/portal/admin/non-teaching-profiles")) items.push({
      id: "non-teaching-profiles", kind: "personnel", title: "Personnel profiles need an update",
      detail: p.non_teaching_count + " non-teaching profile" + (p.non_teaching_count === 1 ? "" : "s") + " with missing required information.",
      href: "/portal/admin/non-teaching-profiles", count: positive(p.non_teaching_count), featureId: "non-teaching",
    });
  }
  const unread = positive(communityUnread);
  if (unread && canOpen("/portal/community")) items.push({
    id: "community-messages", kind: "message", title: "New community messages",
    detail: unread + " unread message" + (unread === 1 ? "" : "s") + " in your school conversations.",
    href: "/portal/community", count: unread, featureId: "community",
  });
  return items;
}

export function featureAttentionCount(items: PortalNotification[], featureId: string): number {
  return items.filter(item => item.featureId === featureId).reduce((count, item) => count + Math.max(1, item.count), 0);
}

// Existing server endpoints remain responsible for identity and permissions.
export async function fetchPortalAttention(
  scope: AttentionScope,
  previous: PortalAttentionData,
  fetcher: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<PortalAttentionData> {
  if (scope.role === "student") return { personnel: null, adviser: null, error: false };
  const tasks: Array<{ key: "personnel" | "adviser"; url: string; init: RequestInit }> = [
    { key: "personnel", url: "/api/teacher-profiles", init: {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "profile_attention" }),
    } },
  ];
  if (scope.role === "teacher" && scope.isAdviser) tasks.push({ key: "adviser", url: "/api/academic/adviser-attention", init: {} });
  let results = await Promise.allSettled(tasks.map(task => fetcher(task.url, { ...task.init, cache: "no-store", signal })));
  if (results.some(result => result.status === "fulfilled" && result.value.status === 401)) {
    const refresh = await fetcher("/api/auth/me", { cache: "no-store", signal }).catch(() => null);
    if (refresh?.ok) results = await Promise.allSettled(results.map((result, index) =>
      result.status === "fulfilled" && result.value.status === 401
        ? fetcher(tasks[index].url, { ...tasks[index].init, cache: "no-store", signal })
        : result.status === "fulfilled" ? Promise.resolve(result.value) : Promise.reject(result.reason)));
  }
  const next: PortalAttentionData = { personnel: previous.personnel, adviser: scope.isAdviser ? previous.adviser : null, error: false };
  for (let i = 0; i < tasks.length; i++) {
    const key = tasks[i].key;
    const result = results[i];
    if (result.status !== "fulfilled") { next.error = true; continue; }
    const response = result.value;
    if (!response.ok) {
      next.error = true;
      if (response.status === 401 || response.status === 403) next[key] = null;
      continue;
    }
    const value = await response.json().catch(() => null);
    if (key === "personnel") {
      if (!value || typeof value.can_manage !== "boolean" || !("self" in value)) { next.error = true; continue; }
      next.personnel = value;
    } else {
      if (!value || !Array.isArray(value.alerts)) { next.error = true; continue; }
      next.adviser = value;
    }
  }
  return next;
}

