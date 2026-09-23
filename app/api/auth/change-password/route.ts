import { NextRequest, NextResponse } from "next/server";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase-config";

export async function POST(request: NextRequest) {
  const token = request.cookies.get("anhs-access-token")?.value;
  if (!token) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const newPassword = String(body?.newPassword ?? "");
  if (newPassword.length < 8) {
    return NextResponse.json({ error: "Use a password with at least 8 characters." }, { status: 400 });
  }

  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/password-change-complete`,
    {
      method: "POST",
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ new_password: newPassword }),
      cache: "no-store",
    }
  );

  const result = await response.json().catch(() => ({}));
  return NextResponse.json(result, { status: response.status });
}
