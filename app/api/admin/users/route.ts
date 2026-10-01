import { NextRequest, NextResponse } from "next/server";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase-config";

function authHeaders(token: string) {
  return {
    apikey: SUPABASE_PUBLISHABLE_KEY,
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

function getToken(request: NextRequest) {
  return request.cookies.get("anhs-access-token")?.value ?? "";
}

async function getUserId(token: string) {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: authHeaders(token),
    cache: "no-store",
  });
  if (!response.ok) return "";
  const user = await response.json().catch(() => null);
  return String(user?.id ?? "");
}

async function isAdmin(token: string) {
  const userId = await getUserId(token);
  if (!userId) return false;

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(
      userId
    )}&select=role,account_status&limit=1`,
    { headers: authHeaders(token), cache: "no-store" }
  );

  if (!response.ok) return false;
  const rows = await response.json().catch(() => []);
  return rows?.[0]?.role === "administrator" && rows?.[0]?.account_status === "active";
}

async function getRows(path: string, token: string) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: authHeaders(token),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Query failed.");
  return response.json();
}

async function getAllProfiles(token: string) {
  const pageSize = 1000;
  const collected: Array<Record<string, unknown>> = [];

  for (let start = 0; start < 10000; start += pageSize) {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?select=id,full_name,email,recovery_phone,lrn,requested_role,role,account_status,grade_level,section,position,created_at&order=full_name.asc`,
      {
        headers: {
          ...authHeaders(token),
          Range: `${start}-${start + pageSize - 1}`,
        },
        cache: "no-store",
      }
    );

    if (!response.ok) throw new Error("Unable to load profiles.");
    const rows = (await response.json().catch(() => [])) as Array<Record<string, unknown>>;
    collected.push(...rows);
    if (rows.length < pageSize) break;
  }

  return collected;
}

export async function GET(request: NextRequest) {
  const token = getToken(request);
  if (!token || !(await isAdmin(token))) {
    return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  }

  try {
    const [profiles, sections, years] = await Promise.all([
      getAllProfiles(token),
      getRows("sections?is_active=eq.true&select=id,grade_level,name&order=grade_level.asc,name.asc", token),
      getRows("school_years?is_active=eq.true&select=id,name&limit=1", token),
    ]);

    const users = profiles.filter((item) => {
      const role = String(item.role ?? "");
      const requestedRole = String(item.requested_role ?? "");
      return role !== "administrator" && ["student", "teacher"].includes(role || requestedRole);
    });

    return NextResponse.json({
      users,
      sections,
      activeYear: years?.[0] ?? null,
    });
  } catch {
    return NextResponse.json({ error: "Unable to load Students and Teachers." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const token = getToken(request);
  if (!token || !(await isAdmin(token))) {
    return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/admin-user-management`,
    {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify(body),
      cache: "no-store",
    }
  );

  const result = await response.json().catch(() => ({}));
  return NextResponse.json(result, { status: response.status });
}
