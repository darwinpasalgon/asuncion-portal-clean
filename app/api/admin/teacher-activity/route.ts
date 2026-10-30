import { NextRequest, NextResponse } from "next/server";
import { isSuperAdministrator } from "@/lib/admin-access";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase-config";

const headers = { "Cache-Control": "private, no-store, max-age=0" };
export async function GET(request: NextRequest) {
  const token = request.cookies.get("anhs-access-token")?.value ?? "";
  if (!token || !(await isSuperAdministrator(token))) {
    return NextResponse.json({ error: "Super Administrator access required." }, { status: 403, headers });
  }
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/teacher_portal_activity_report`, {
      method: "POST",
      headers: { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: "{}",
      cache: "no-store",
    });
    if (!response.ok) throw new Error("Activity service unavailable");
    return NextResponse.json(await response.json(), { headers });
  } catch {
    return NextResponse.json({ error: "Unable to load teacher activity. Please try again." }, { status: 502, headers });
  }
}
