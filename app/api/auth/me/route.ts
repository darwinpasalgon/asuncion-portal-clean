import { NextRequest, NextResponse } from "next/server";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase-config";

function authHeaders(token: string) {
  return {
    apikey: SUPABASE_PUBLISHABLE_KEY,
    Authorization: `Bearer ${token}`,
  };
}

export async function GET(request: NextRequest) {
  const token = request.cookies.get("anhs-access-token")?.value ?? "";
  if (!token) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const userResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: authHeaders(token),
    cache: "no-store",
  });

  if (!userResponse.ok) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const user = await userResponse.json().catch(() => null);
  const userId = String(user?.id ?? "");
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const profileResponse = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(
      userId
    )}&select=id,full_name,email,lrn,role,requested_role,account_status,must_change_password&limit=1`,
    {
      headers: authHeaders(token),
      cache: "no-store",
    }
  );

  if (!profileResponse.ok) {
    return NextResponse.json({ error: "Unable to load your profile." }, { status: 500 });
  }

  const rows = await profileResponse.json().catch(() => []);
  const profile = rows?.[0];

  if (!profile || profile.account_status !== "active" || !profile.role) {
    return NextResponse.json({ error: "Your account is not active." }, { status: 403 });
  }

  return NextResponse.json({ profile });
}
