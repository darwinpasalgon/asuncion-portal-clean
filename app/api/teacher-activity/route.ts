import { NextRequest, NextResponse } from "next/server";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase-config";

const headers = { "Cache-Control": "private, no-store" };
export async function POST(request: NextRequest) {
  const token = request.cookies.get("anhs-access-token")?.value ?? "";
  if (!token) return NextResponse.json({ error: "Sign in required." }, { status: 401, headers });
  const origin = request.headers.get("origin");
  if ((origin && origin !== request.nextUrl.origin) || request.headers.get("sec-fetch-site") === "cross-site") {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403, headers });
  }
  try {
    // Identity, role, date and timestamps are determined inside the database.
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/record_teacher_portal_activity`, {
      method: "POST",
      headers: { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: "{}",
      cache: "no-store",
    });
    return NextResponse.json({ ok: response.ok }, { status: response.ok ? 200 : 403, headers });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503, headers });
  }
}
