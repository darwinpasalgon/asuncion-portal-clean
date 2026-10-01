import { NextRequest, NextResponse } from "next/server";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase-config";

function headers(token: string) {
  return {
    apikey: SUPABASE_PUBLISHABLE_KEY,
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

async function callManagement(token: string, body: Record<string, unknown>) {
  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/admin-staff-management`,
    {
      method: "POST",
      headers: headers(token),
      body: JSON.stringify(body),
      cache: "no-store",
    }
  );
  const result = await response.json().catch(() => ({}));
  return { response, result };
}

export async function GET(request: NextRequest) {
  const token = request.cookies.get("anhs-access-token")?.value ?? "";
  if (!token) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { response, result } = await callManagement(token, { action: "list" });
  return NextResponse.json(result, { status: response.status });
}

export async function POST(request: NextRequest) {
  const token = request.cookies.get("anhs-access-token")?.value ?? "";
  if (!token) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { response, result } = await callManagement(token, body);
  return NextResponse.json(result, { status: response.status });
}
