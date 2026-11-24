export const PORTAL_VISITOR_LIMIT = 20;
export type PortalVisitor = {
  rank: number;
  full_name: string;
  visit_days: number;
  is_you: boolean;
};
export type PortalVisitorsReport = {
  period_start: string;
  period_end: string;
  tracking_started_on: string;
  visitors: PortalVisitor[];
};

const responseHeaders = { "Cache-Control": "private, no-store, max-age=0", Vary: "Cookie" };

function schoolDate(value: unknown): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("Invalid report date.");
  const date = new Date(value + "T00:00:00Z");
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new Error("Invalid report date.");
  return value;
}

export function normalizePortalVisitorsReport(value: unknown): PortalVisitorsReport {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid visitor report.");
  const data = value as Record<string, unknown>;
  const period_start = schoolDate(data.period_start);
  const period_end = schoolDate(data.period_end);
  const tracking_started_on = schoolDate(data.tracking_started_on);
  if (Date.parse(period_end) - Date.parse(period_start) !== 29 * 86_400_000 || tracking_started_on > period_end || !Array.isArray(data.visitors)) throw new Error("Invalid report period.");
  const visitors = data.visitors.slice(0, PORTAL_VISITOR_LIMIT).map((raw, index): PortalVisitor => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Invalid visitor.");
    const row = raw as Record<string, unknown>;
    if (row.rank !== index + 1 || typeof row.full_name !== "string" || !row.full_name.trim() ||
      typeof row.visit_days !== "number" || !Number.isInteger(row.visit_days) || row.visit_days < 1 || row.visit_days > 30 ||
      typeof row.is_you !== "boolean") throw new Error("Invalid visitor.");
    return { rank: index + 1, full_name: row.full_name.trim(), visit_days: row.visit_days, is_you: row.is_you };
  });
  return { period_start, period_end, tracking_started_on, visitors };
}

// The database validates the signed-in, active profile and returns only a
// bounded community leaderboard. Raw activity and account records stay private.
export async function portalVisitorsResponse(
  token: string,
  config: { url: string; publishableKey: string },
  fetcher: typeof fetch = fetch,
): Promise<Response> {
  const error = (message: string, status: number) => Response.json({ error: message }, { status, headers: responseHeaders });
  if (!token) return error("Sign in to view portal visitors.", 401);
  try {
    const response = await fetcher(config.url + "/rest/v1/rpc/portal_top_visitors", {
      method: "POST",
      headers: { apikey: config.publishableKey, Authorization: "Bearer " + token, "Content-Type": "application/json" },
      body: "{}",
      cache: "no-store",
    });
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) return error("An active account with a completed password change is required.", response.status);
      return error("Unable to load portal visitors. Please try again.", 502);
    }
    return Response.json(normalizePortalVisitorsReport(await response.json()), { headers: responseHeaders });
  } catch {
    return error("Unable to load portal visitors. Please try again.", 502);
  }
}


