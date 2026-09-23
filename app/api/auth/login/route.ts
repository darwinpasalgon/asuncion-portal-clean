import { NextResponse } from "next/server";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase-config";

export async function POST(request: Request) {
  let body: { identifier?: string; password?: string };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const identifier = String(body.identifier ?? "").trim();
  const password = String(body.password ?? "");

  if (!identifier || !password) {
    return NextResponse.json(
      { error: "Enter your LRN or email and password." },
      { status: 400 }
    );
  }

  const response = await fetch(`${SUPABASE_URL}/functions/v1/portal-login`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ identifier, password }),
    cache: "no-store",
  });

  const result = await response.json().catch(() => ({}));

  if (!response.ok || !result.access_token || !result.refresh_token) {
    return NextResponse.json(
      { error: result.error ?? "Unable to sign in." },
      { status: response.status || 401 }
    );
  }

  const nextResponse = NextResponse.json({
    ok: true,
    profile: result.profile ?? null,
  });

  const secure = process.env.NODE_ENV === "production";

  nextResponse.cookies.set("anhs-access-token", result.access_token, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: Number(result.expires_in ?? 3600),
  });

  nextResponse.cookies.set("anhs-refresh-token", result.refresh_token, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 60,
  });

  return nextResponse;
}
