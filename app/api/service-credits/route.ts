import { NextRequest, NextResponse } from "next/server";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase-config";

function headers(token: string) {
  return {
    apikey: SUPABASE_PUBLISHABLE_KEY,
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

export async function POST(request: NextRequest) {
  const token = request.cookies.get("anhs-access-token")?.value ?? "";
  if (!token) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) ?? {};
  const response = await fetch(`${SUPABASE_URL}/functions/v1/service-credits`, {
    method: "POST",
    headers: headers(token),
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const result = await response.json().catch(() => ({}));
  return NextResponse.json(result, { status: response.status });
}
