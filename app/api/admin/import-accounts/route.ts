import { NextRequest, NextResponse } from "next/server";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase-config";

function headers(token: string) {
  return {
    apikey: SUPABASE_PUBLISHABLE_KEY,
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

async function isActiveAdmin(token: string) {
  const userResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: headers(token),
    cache: "no-store",
  });
  if (!userResponse.ok) return false;
  const user = await userResponse.json().catch(() => null);
  const id = String(user?.id ?? "");
  if (!id) return false;

  const profileResponse = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(id)}&select=role,account_status,admin_role&limit=1`,
    { headers: headers(token), cache: "no-store" }
  );
  if (!profileResponse.ok) return false;
  const profiles = await profileResponse.json().catch(() => []);
  return (
    profiles?.[0]?.role === "administrator" &&
    profiles?.[0]?.account_status === "active" &&
    profiles?.[0]?.admin_role === "super_administrator"
  );
}

export async function POST(request: NextRequest) {
  const token = request.cookies.get("anhs-access-token")?.value ?? "";
  if (!token || !(await isActiveAdmin(token))) {
    return NextResponse.json({ error: "Super Administrator access required." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (body.action === "credential_candidates") {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/admin-bulk-account-import`, {
      method: "POST",
      headers: headers(token),
      body: JSON.stringify({ action: "credential_candidates" }),
      cache: "no-store",
    });
    const result = await response.json().catch(() => ({}));
    return NextResponse.json(result, { status: response.status });
  }

  if (body.action === "reissue_credentials") {
    const userIds = Array.isArray(body.userIds)
      ? body.userIds.map((value: unknown) => String(value ?? "").trim()).filter(Boolean)
      : [];
    if (!userIds.length || userIds.length > 20) {
      return NextResponse.json(
        { error: "Credential recovery batches must contain 1 to 20 Teacher accounts." },
        { status: 400 }
      );
    }

    const response = await fetch(`${SUPABASE_URL}/functions/v1/admin-bulk-account-import`, {
      method: "POST",
      headers: headers(token),
      body: JSON.stringify({
        action: "reissue_credentials",
        user_ids: userIds,
      }),
      cache: "no-store",
    });
    const result = await response.json().catch(() => ({}));
    return NextResponse.json(result, { status: response.status });
  }

  if (body.action !== "import" || !Array.isArray(body.rows)) {
    return NextResponse.json({ error: "Invalid import request." }, { status: 400 });
  }

  if (body.rows.length < 1 || body.rows.length > 200) {
    return NextResponse.json(
      { error: "Each import batch must contain between 1 and 200 records." },
      { status: 400 }
    );
  }

  const response = await fetch(`${SUPABASE_URL}/functions/v1/admin-bulk-account-import`, {
    method: "POST",
    headers: headers(token),
    body: JSON.stringify({
      action: "import",
      person_type: body.personType === "teacher" ? "teacher" : "student",
      file_name: String(body.fileName ?? "account-import.csv"),
      rows: body.rows.map((row: Record<string, unknown>) => ({
        ...row,
        recovery_phone: String(row.mobile ?? row.recovery_phone ?? ""),
      })),
    }),
    cache: "no-store",
  });

  const result = await response.json().catch(() => ({}));
  return NextResponse.json(result, { status: response.status });
}
