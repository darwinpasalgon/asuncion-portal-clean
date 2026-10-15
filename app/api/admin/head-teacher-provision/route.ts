import { NextRequest, NextResponse } from "next/server";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase-config";

export async function POST(request: NextRequest) {
  const token = request.cookies.get("anhs-access-token")?.value ?? "";
  if (!token) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const personnelId = String(body?.personnel_id ?? "");
  if (!/^[a-f0-9-]{36}$/i.test(personnelId)) {
    return NextResponse.json({ error: "Invalid personnel record." }, { status: 400 });
  }

  const response = await fetch(`${SUPABASE_URL}/functions/v1/admin-head-teacher-provision`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ action: "provision", personnel_id: personnelId }),
    cache: "no-store",
  });
  const result = await response.json().catch(() => ({}));
  return NextResponse.json(result, {
    status: response.status,
    headers: { "Cache-Control": "no-store" },
  });
}
