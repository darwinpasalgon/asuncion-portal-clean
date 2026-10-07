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

type RefreshedSession = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
};

async function refreshSession(refreshToken: string): Promise<RefreshedSession | null> {
  if (!refreshToken) return null;

  const response = await fetch(
    `${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`,
    {
      method: "POST",
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
      cache: "no-store",
    }
  );

  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.access_token || !result.refresh_token) {
    return null;
  }

  return {
    access_token: String(result.access_token),
    refresh_token: String(result.refresh_token),
    expires_in: Number(result.expires_in ?? 3600),
  };
}

function setSessionCookies(
  response: NextResponse,
  session: RefreshedSession
) {
  const secure = process.env.NODE_ENV === "production";

  response.cookies.set("anhs-access-token", session.access_token, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: session.expires_in,
  });

  response.cookies.set("anhs-refresh-token", session.refresh_token, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 60,
  });
}

function clearSessionCookies(response: NextResponse) {
  const secure = process.env.NODE_ENV === "production";

  for (const name of ["anhs-access-token", "anhs-refresh-token"]) {
    response.cookies.set(name, "", {
      httpOnly: true,
      secure,
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
  }
}

export async function GET(request: NextRequest) {
  let token = request.cookies.get("anhs-access-token")?.value ?? "";
  const refreshToken = request.cookies.get("anhs-refresh-token")?.value ?? "";
  let refreshedSession: RefreshedSession | null = null;

  let userResponse = token
    ? await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        headers: authHeaders(token),
        cache: "no-store",
      })
    : null;

  if (!userResponse?.ok && refreshToken) {
    refreshedSession = await refreshSession(refreshToken);
    if (refreshedSession) {
      token = refreshedSession.access_token;
      userResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        headers: authHeaders(token),
        cache: "no-store",
      });
    }
  }

  if (!userResponse?.ok || !token) {
    const response = NextResponse.json(
      { error: "Unauthorized." },
      { status: 401 }
    );
    clearSessionCookies(response);
    return response;
  }

  const user = await userResponse.json().catch(() => null);
  const userId = String(user?.id ?? "");
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const profiles = await getRows(
    `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(
      userId
    )}&select=id,full_name,email,lrn,grade_level,section,role,requested_role,admin_role,position,account_status,must_change_password&limit=1`,
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
    tve_major: string | null;
    sex: string | null;
  } = {
    school_year: null,
    school_year_id: null,
    grade_level: null,
    section: null,
    enrollment_status: null,
    tve_major: null,
    sex: null,
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
        )}&select=grade_level,section_id,enrollment_status,tve_major&limit=1`,
        token
      );

      const enrollment = enrollments?.[0] ?? null;
      if (enrollment) {
        academicContext.grade_level = enrollment.grade_level;
        academicContext.enrollment_status = enrollment.enrollment_status;
        academicContext.tve_major = enrollment.tve_major ?? null;

        const learnerRows = await getRows(
          `${SUPABASE_URL}/rest/v1/learner_information?student_id=eq.${encodeURIComponent(
            userId
          )}&select=sex&limit=1`,
          token
        );
        const learnerSex = String(learnerRows?.[0]?.sex ?? "").trim().toUpperCase();
        academicContext.sex =
          learnerSex === "M" || learnerSex === "F" ? learnerSex : null;

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

  let adminPermissions: string[] = [];
  if (profile.role === "staff_administrator") {
    const permissionRows = await getRows(
      `${SUPABASE_URL}/rest/v1/administrator_permissions?administrator_id=eq.${encodeURIComponent(
        userId
      )}&select=permission&order=permission.asc`,
      token
    );
    adminPermissions = (permissionRows ?? []).map(
      (item: { permission?: string }) => String(item.permission ?? "")
    ).filter(Boolean);
  }

  const gradeLevelHeadRows = await getRows(
    `${SUPABASE_URL}/rest/v1/grade_level_heads?profile_id=eq.${encodeURIComponent(
      userId
    )}&is_active=eq.true&select=grade_level,display_name&limit=1`,
    token
  );
  const gradeLevelHeadRow = gradeLevelHeadRows?.[0] ?? null;
  const gradeLevelHead = gradeLevelHeadRow
    ? {
        grade_level: Number(gradeLevelHeadRow.grade_level),
        display_name: String(gradeLevelHeadRow.display_name ?? profile.full_name),
      }
    : null;

  const response = NextResponse.json({
    profile,
    academicContext,
    adminPermissions,
    gradeLevelHead,
  });

  if (refreshedSession) {
    setSessionCookies(response, refreshedSession);
  }

  return response;
}
