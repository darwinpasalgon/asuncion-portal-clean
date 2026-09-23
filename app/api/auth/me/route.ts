import { NextRequest, NextResponse } from "next/server";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase-config";

function authHeaders(token: string) {
  return {
    apikey: SUPABASE_PUBLISHABLE_KEY,
    Authorization: `Bearer ${token}`,
  };
}

async function getRows(url: string, token: string) {
  const response = await fetch(url, {
    headers: authHeaders(token),
    cache: "no-store",
  });
  if (!response.ok) return null;
  return response.json().catch(() => []);
}

export async function GET(request: NextRequest) {
  const token = request.cookies.get("anhs-access-token")?.value ?? "";
  if (!token) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const userResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: authHeaders(token),
    cache: "no-store",
  });

  if (!userResponse.ok) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const user = await userResponse.json().catch(() => null);
  const userId = String(user?.id ?? "");
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const profiles = await getRows(
    `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(
      userId
    )}&select=id,full_name,email,lrn,grade_level,section,role,requested_role,account_status,must_change_password&limit=1`,
    token
  );

  if (!profiles) {
    return NextResponse.json({ error: "Unable to load your profile." }, { status: 500 });
  }

  const profile = profiles?.[0];
  if (!profile || profile.account_status !== "active" || !profile.role) {
    return NextResponse.json({ error: "Your account is not active." }, { status: 403 });
  }

  let academicContext: {
    school_year: string | null;
    school_year_id: string | null;
    grade_level: number | null;
    section: string | null;
    enrollment_status: string | null;
  } = {
    school_year: null,
    school_year_id: null,
    grade_level: null,
    section: null,
    enrollment_status: null,
  };

  const schoolYears = await getRows(
    `${SUPABASE_URL}/rest/v1/school_years?is_active=eq.true&select=id,name&limit=1`,
    token
  );

  const activeYear = schoolYears?.[0] ?? null;
  if (activeYear) {
    academicContext.school_year = activeYear.name;
    academicContext.school_year_id = activeYear.id;

    if (profile.role === "student") {
      const enrollments = await getRows(
        `${SUPABASE_URL}/rest/v1/student_enrollments?student_id=eq.${encodeURIComponent(
          userId
        )}&school_year_id=eq.${encodeURIComponent(
          activeYear.id
        )}&select=grade_level,section_id,enrollment_status&limit=1`,
        token
      );

      const enrollment = enrollments?.[0] ?? null;
      if (enrollment) {
        academicContext.grade_level = enrollment.grade_level;
        academicContext.enrollment_status = enrollment.enrollment_status;

        if (enrollment.section_id) {
          const sectionRows = await getRows(
            `${SUPABASE_URL}/rest/v1/sections?id=eq.${encodeURIComponent(
              enrollment.section_id
            )}&select=name&limit=1`,
            token
          );
          academicContext.section = sectionRows?.[0]?.name ?? null;
        }
      }
    }
  }

  return NextResponse.json({ profile, academicContext });
}
