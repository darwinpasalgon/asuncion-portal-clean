import { NextRequest, NextResponse } from "next/server";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase-config";
import { hasAdminPermission } from "@/lib/admin-access";

async function callAdminReset(token: string, body: Record<string, unknown>) {
  return fetch(`${SUPABASE_URL}/functions/v1/password-reset-admin`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
}

export async function GET(request: NextRequest) {
  const token = request.cookies.get("anhs-access-token")?.value;
  if (!token) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  if (!(await hasAdminPermission(token, "password_resets.manage"))) {
    return NextResponse.json({ error: "Password Reset permission required." }, { status: 403 });
  }

  const response = await callAdminReset(token, { action: "list" });
  const result = await response.json().catch(() => ({}));
  return NextResponse.json(result, { status: response.status });
}

export async function POST(request: NextRequest) {
  const token = request.cookies.get("anhs-access-token")?.value;
  if (!token) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  if (!(await hasAdminPermission(token, "password_resets.manage"))) {
    return NextResponse.json({ error: "Password Reset permission required." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (body.userId) {
    const response = await callAdminReset(token, {
      action: "request",
      user_id: String(body.userId),
    });
    const result = await response.json().catch(() => ({}));
    return NextResponse.json(result, { status: response.status });
  }

  if (body.requestId) {
    const response = await callAdminReset(token, {
      action: "reset",
      request_id: String(body.requestId),
    });
    const result = await response.json().catch(() => ({}));
    return NextResponse.json(result, { status: response.status });
  }

  return NextResponse.json(
    { error: "User account or reset request is required." },
    { status: 400 }
  );
}
