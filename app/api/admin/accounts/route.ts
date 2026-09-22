import { NextRequest, NextResponse } from "next/server";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase-config";

function authHeaders(token: string) {
  return {
    apikey: SUPABASE_PUBLISHABLE_KEY,
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

async function currentUserIsAdmin(token: string) {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?select=id,role,account_status&id=eq.${encodeURIComponent(
      await getUserId(token)
    )}&limit=1`,
    { headers: authHeaders(token), cache: "no-store" }
  );

  if (!response.ok) return false;
  const rows = await response.json();
  const profile = rows?.[0];
  return profile?.role === "administrator" && profile?.account_status === "active";
}

async function getUserId(token: string) {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: authHeaders(token),
    cache: "no-store",
  });

  if (!response.ok) return "";
  const user = await response.json();
  return String(user?.id ?? "");
}

function getToken(request: NextRequest) {
  return request.cookies.get("anhs-access-token")?.value ?? "";
}

export async function GET(request: NextRequest) {
  const token = getToken(request);
  if (!token || !(await currentUserIsAdmin(token))) {
    return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  }

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?select=id,full_name,email,recovery_phone,lrn,grade_level,section,requested_role,role,account_status,created_at&account_status=eq.pending&order=created_at.asc`,
    { headers: authHeaders(token), cache: "no-store" }
  );

  if (!response.ok) {
    return NextResponse.json({ error: "Unable to load pending accounts." }, { status: 500 });
  }

  return NextResponse.json({ accounts: await response.json() });
}

export async function POST(request: NextRequest) {
  const token = getToken(request);
  if (!token || !(await currentUserIsAdmin(token))) {
    return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const id = String(body?.id ?? "");
  const action = body?.action === "approve" ? "approve" : body?.action === "reject" ? "reject" : "";

  if (!id || !action) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const lookup = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?select=id,requested_role,account_status,grade_level,section&id=eq.${encodeURIComponent(id)}&limit=1`,
    { headers: authHeaders(token), cache: "no-store" }
  );

  if (!lookup.ok) {
    return NextResponse.json({ error: "Unable to verify the account." }, { status: 500 });
  }

  const rows = await lookup.json();
  const profile = rows?.[0];

  if (!profile || profile.account_status !== "pending") {
    return NextResponse.json({ error: "This account is no longer pending." }, { status: 409 });
  }

  if (action === "approve" && profile.requested_role === "student") {
    const gradeLevel = Number(profile.grade_level ?? 0);

    if (!Number.isInteger(gradeLevel) || gradeLevel < 7 || gradeLevel > 12) {
      return NextResponse.json(
        { error: "This student does not have a valid grade level. Update the student record before approval." },
        { status: 409 }
      );
    }

    const gradeCheck = await fetch(
      `${SUPABASE_URL}/rest/v1/grade_levels?grade_level=eq.${gradeLevel}&select=grade_level&limit=1`,
      { headers: authHeaders(token), cache: "no-store" }
    );
    const sectionCheck = await fetch(
      `${SUPABASE_URL}/rest/v1/sections?grade_level=eq.${gradeLevel}&is_active=eq.true&select=name&order=name.asc`,
      { headers: authHeaders(token), cache: "no-store" }
    );

    if (!gradeCheck.ok || !sectionCheck.ok) {
      return NextResponse.json(
        { error: "Unable to verify the student's academic placement." },
        { status: 500 }
      );
    }

    const gradeRows = await gradeCheck.json().catch(() => []);
    const sectionRows = await sectionCheck.json().catch(() => []);
    const activeSections = (sectionRows ?? []).map((item: { name?: string }) =>
      String(item.name ?? "")
    );

    if (!gradeRows?.[0]) {
      return NextResponse.json(
        { error: "This student does not have a valid grade level." },
        { status: 409 }
      );
    }

    if (
      activeSections.length > 0 &&
      !activeSections.includes(String(profile.section ?? ""))
    ) {
      return NextResponse.json(
        { error: "This student does not have a valid active section for the selected grade level." },
        { status: 409 }
      );
    }
  }

  const update =
    action === "approve"
      ? {
          role: profile.requested_role,
          account_status: "active",
          updated_at: new Date().toISOString(),
        }
      : {
          role: null,
          account_status: "suspended",
          updated_at: new Date().toISOString(),
        };

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      headers: {
        ...authHeaders(token),
        Prefer: "return=representation",
      },
      body: JSON.stringify(update),
      cache: "no-store",
    }
  );

  if (!response.ok) {
    return NextResponse.json({ error: "Unable to update the account." }, { status: 500 });
  }

  const updated = await response.json();
  return NextResponse.json({ ok: true, account: updated?.[0] ?? null });
}
