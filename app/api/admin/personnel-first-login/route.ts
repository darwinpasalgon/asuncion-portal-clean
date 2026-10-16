import { NextRequest, NextResponse } from "next/server";
import { isSuperAdministrator } from "@/lib/admin-access";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase-config";

const remote = `${SUPABASE_URL}/functions/v1/admin-personnel-first-login`;
type IssuedCredential = {
  full_name: string;
  email: string;
  position: string;
  role: string;
  temporary_password: string;
};
function safeCsvCell(value: unknown) {
  const raw = String(value ?? "");
  const safe = /^[\s\uFEFF]*[=+@\-]/.test(raw) ? "'" + raw : raw;
  return '"' + safe.replace(/"/g, '""') + '"';
}
async function remoteAction(token: string, body: Record<string, unknown>) {
  const response = await fetch(remote, {
    method: "POST",
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}
const noStore = { "Cache-Control": "private, no-store, max-age=0" };
function denied() {
  return NextResponse.json({ error: "Super Administrator access required." }, { status: 403, headers: noStore });
}
export async function GET(request: NextRequest) {
  const token = request.cookies.get("anhs-access-token")?.value ?? "";
  if (!token || !(await isSuperAdministrator(token))) return denied();
  try {
    const { response, payload } = await remoteAction(token, { action: "candidates" });
    return NextResponse.json(response.ok ? {
      count: Number(payload.count ?? 0),
      teacher_count: Number(payload.teacher_count ?? 0),
      staff_count: Number(payload.staff_count ?? 0),
    } : { error: payload.error ?? "Unable to check first-login accounts." }, {
      status: response.status,
      headers: noStore,
    });
  } catch {
    return NextResponse.json({ error: "Unable to reach first-login credentials service." }, { status: 502, headers: noStore });
  }
}

export async function POST(request: NextRequest) {
  const token = request.cookies.get("anhs-access-token")?.value ?? "";
  if (!token || !(await isSuperAdministrator(token))) return denied();
  // Reject cross-site POST attempts against cookie-authenticated operations.
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).origin !== request.nextUrl.origin) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403, headers: noStore });
  }
  const body = request.headers.get("content-type")?.includes("application/x-www-form-urlencoded")
    ? Object.fromEntries(new URLSearchParams(await request.text()))
    : await request.json().catch(() => ({}));
  if (body?.confirm !== "ISSUE_FIRST_LOGIN_PASSWORDS") {
    return NextResponse.json({ error: "Explicit confirmation required." }, { status: 400, headers: noStore });
  }

  try {
    const { response, payload } = await remoteAction(token, {
      action: "issue",
      scope: "all",
      confirm: "ISSUE_FIRST_LOGIN_PASSWORDS",
    });
    if (!response.ok) {
      return NextResponse.json({
        error: payload.error ?? "No first-login credentials could be generated.",
      }, { status: response.status, headers: noStore });
    }
    const credentials = (Array.isArray(payload.issued) ? payload.issued : []) as IssuedCredential[];
    if (!credentials.length) {
      return NextResponse.json({ error: "No eligible first-login accounts were found." }, { status: 409, headers: noStore });
    }
    const rows: unknown[][] = [
      ["Full Name", "Login Email", "Position", "Personnel Type", "Temporary Password", "Login URL", "First Login"],
      ...credentials.map(row => [
        row.full_name,
        row.email,
        row.position,
        row.role === "teacher" ? "Teaching Personnel" : "Staff Administrator",
        row.temporary_password,
        "https://asuncion-nhs.vercel.app",
        "Change password after first login",
      ]),
    ];
    const csv = "\uFEFF" + rows.map(row => row.map(safeCsvCell).join(",")).join("\r\n");
    const failed = Array.isArray(payload.errors) ? payload.errors.length : 0;
    return new NextResponse(csv, {
      status: 200,
      headers: {
        ...noStore,
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": "attachment; filename=\"ANHS_Personnel_First_Login_Credentials.csv\"",
        "X-Credentials-Issued": String(credentials.length),
        "X-Credentials-Warnings": String(failed),
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({
      error: "Unable to complete the credential download. If passwords were issued before the connection failed, generate a fresh CSV before distributing credentials.",
    }, { status: 502, headers: noStore });
  }
}
