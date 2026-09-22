import { NextRequest, NextResponse } from "next/server";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase-config";

function headers(token: string) {
  return {
    apikey: SUPABASE_PUBLISHABLE_KEY,
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

function tokenFrom(request: NextRequest) {
  return request.cookies.get("anhs-access-token")?.value ?? "";
}

async function getUserId(token: string) {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: headers(token),
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
    { headers: headers(token), cache: "no-store" }
  );

  if (!response.ok) return false;
  const rows = await response.json().catch(() => []);
  return rows?.[0]?.role === "administrator" && rows?.[0]?.account_status === "active";
}

async function restJson(url: string, token: string) {
  const response = await fetch(url, { headers: headers(token), cache: "no-store" });
  if (!response.ok) throw new Error("Academic structure query failed.");
  return response.json();
}

export async function GET(request: NextRequest) {
  const token = tokenFrom(request);
  if (!token || !(await isAdmin(token))) {
    return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  }

  try {
    const [schoolYears, gradeLevels, sections, enrollments] = await Promise.all([
      restJson(
        `${SUPABASE_URL}/rest/v1/school_years?select=id,name,start_year,end_year,is_active&order=start_year.desc`,
        token
      ),
      restJson(
        `${SUPABASE_URL}/rest/v1/grade_levels?select=grade_level,label,sort_order&order=sort_order.asc`,
        token
      ),
      restJson(
        `${SUPABASE_URL}/rest/v1/sections?select=id,grade_level,name,is_active&order=grade_level.asc,name.asc`,
        token
      ),
      restJson(
        `${SUPABASE_URL}/rest/v1/student_enrollments?select=id,school_year_id,grade_level,section_id,enrollment_status&order=enrolled_at.desc`,
        token
      ),
    ]);

    return NextResponse.json({
      schoolYears,
      gradeLevels,
      sections,
      enrollments,
    });
  } catch {
    return NextResponse.json(
      { error: "Unable to load the academic structure." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const token = tokenFrom(request);
  if (!token || !(await isAdmin(token))) {
    return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const action = String(body?.action ?? "");

  if (action === "add_section") {
    const gradeLevel = Number(body?.gradeLevel ?? 0);
    const name = String(body?.name ?? "").trim().replace(/\s+/g, " ");

    if (!Number.isInteger(gradeLevel) || gradeLevel < 7 || gradeLevel > 12) {
      return NextResponse.json({ error: "Select a valid grade level." }, { status: 400 });
    }

    if (name.length < 2 || name.length > 60) {
      return NextResponse.json(
        { error: "Section name must contain 2 to 60 characters." },
        { status: 400 }
      );
    }

    const response = await fetch(`${SUPABASE_URL}/rest/v1/sections`, {
      method: "POST",
      headers: {
        ...headers(token),
        Prefer: "return=representation",
      },
      body: JSON.stringify({ grade_level: gradeLevel, name, is_active: true }),
      cache: "no-store",
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detail = String(result?.message ?? result?.details ?? "").toLowerCase();
      return NextResponse.json(
        {
          error: detail.includes("duplicate")
            ? "That section already exists for this grade level."
            : "Unable to add the section.",
        },
        { status: response.status || 400 }
      );
    }

    return NextResponse.json({ ok: true, section: result?.[0] ?? null });
  }

  if (action === "set_section_active") {
    const id = String(body?.id ?? "");
    const isActive = Boolean(body?.isActive);
    if (!id) {
      return NextResponse.json({ error: "Section is required." }, { status: 400 });
    }

    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/sections?id=eq.${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        headers: {
          ...headers(token),
          Prefer: "return=representation",
        },
        body: JSON.stringify({ is_active: isActive, updated_at: new Date().toISOString() }),
        cache: "no-store",
      }
    );

    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result?.[0]) {
      return NextResponse.json({ error: "Unable to update the section." }, { status: 400 });
    }

    return NextResponse.json({ ok: true, section: result[0] });
  }

  return NextResponse.json({ error: "Invalid action." }, { status: 400 });
}
