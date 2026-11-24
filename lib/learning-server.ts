import { NextRequest, NextResponse } from "next/server";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase-config";

export class LearningError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export const learningHeaders = (token: string) => ({ apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${token}` });
export function learningJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
}
export function learningFailure(error: unknown) {
  return learningJson({ error: error instanceof Error ? error.message : "The learning service is unavailable." }, error instanceof LearningError ? error.status : 400);
}
export async function learningRows(path: string, token: string, init: RequestInit = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: { ...learningHeaders(token), "Content-Type": "application/json", ...init.headers },
    cache: "no-store",
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const message = data?.code === "42501" ? "You do not have permission for this record."
      : data?.code === "23514" || data?.code === "P0001" ? "The record is not valid for this learner or tutor. Check the dates, scores, and tutor assignment."
      : "Unable to save or load this record. Please try again.";
    throw new LearningError(message, response.status >= 500 ? 503 : 400);
  }
  return data ?? [];
}
export async function learningIdentity(request: NextRequest) {
  const token = request.cookies.get("anhs-access-token")?.value ?? "";
  if (!token) throw new LearningError("Sign in to continue.", 401);
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: learningHeaders(token), cache: "no-store" });
  const user = await response.json().catch(() => null);
  if (!response.ok || !user?.id) throw new LearningError("Your session has expired. Sign in again.", 401);
  const rows = await learningRows(`profiles?id=eq.${encodeURIComponent(user.id)}&select=id,full_name,role,account_status,must_change_password&limit=1`, token);
  const profile = rows[0];
  if (!profile || profile.account_status !== "active" || profile.must_change_password || !["teacher", "student", "administrator"].includes(profile.role)) throw new LearningError("This account cannot access learning tools. Complete any required password change first.", 403);
  return { token, profile: profile as { id: string; full_name: string; role: "teacher" | "student" | "administrator" } };
}
export async function learningBody(request: NextRequest) {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > 220000) throw new LearningError("This form is too large.", 413);
  const raw = await request.text();
  if (raw.length > 220000) throw new LearningError("This form is too large.", 413);
  try { return JSON.parse(raw); } catch { throw new LearningError("Invalid form data."); }
}
