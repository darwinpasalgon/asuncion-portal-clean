import { NextRequest, NextResponse } from "next/server";
import { hasAdminPermission } from "@/lib/admin-access";
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
  return hasAdminPermission(token, "users.manage");
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
    const [profiles, sections, years, learnerInformation] = await Promise.all([
      getAllProfiles(token),
      getRows("sections?is_active=eq.true&select=id,grade_level,name&order=grade_level.asc,name.asc", token),
      getRows("school_years?is_active=eq.true&select=id,name&limit=1", token),
      getRows(
        "learner_information?select=student_id,last_name,first_name,middle_name,name_extension,sex,birth_date,mother_tongue,is_indigenous_peoples,ethnic_group,religion,cct_recipient,address_house_street_purok,address_barangay,address_municipality_city,address_province,father_name,mother_maiden_name,guardian_name,guardian_relationship,guardian_contact_number,learning_modality,remarks",
        token
      ),
    ]);

    const learnerMap = new Map(
      (learnerInformation ?? []).map((item: Record<string, unknown>) => [
        String(item.student_id ?? ""),
        item,
      ])
    );

    const users = profiles
      .filter((item) => {
        const role = String(item.role ?? "");
        const requestedRole = String(item.requested_role ?? "");
        return role !== "administrator" && ["student", "teacher"].includes(role || requestedRole);
      })
      .map((item) => ({
        ...item,
        learner_info: learnerMap.get(String(item.id ?? "")) ?? null,
      }));

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
