import { NextRequest, NextResponse } from "next/server";
import { hasAdminPermission } from "@/lib/admin-access";
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
  return hasAdminPermission(token, "school_setup.manage");
}

const SHS_PROGRAM_TYPES = new Set(["Regular SHS", "ALS-SHS"]);
const GRADE11_PROGRAM_CODES = new Set([
  "STEM", "TVL", "BUSINESS_ENTREPRENEURSHIP",
  "ASSH", "TVL_OAP", "TVL_FOOD_PROCESSING",
]);

function validShsProgramType(value: unknown) {
  return SHS_PROGRAM_TYPES.has(String(value ?? "").trim());
}

async function restJson(url: string, token: string) {
  const response = await fetch(url, { headers: headers(token), cache: "no-store" });
  if (!response.ok) throw new Error("Academic structure query failed.");
  return response.json();
}

async function restAllJson(url: string, token: string, pageSize = 1000) {
  const rows: unknown[] = [];
  let start = 0;

  while (true) {
    const response = await fetch(url, {
      headers: {
        ...headers(token),
        Range: `${start}-${start + pageSize - 1}`,
      },
      cache: "no-store",
    });
    if (!response.ok) throw new Error("Academic structure paged query failed.");

    const page = await response.json().catch(() => []);
    if (!Array.isArray(page)) throw new Error("Invalid academic structure response.");

    rows.push(...page);
    if (page.length < pageSize) break;

    start += pageSize;
    if (start >= 100000) {
      throw new Error("Academic structure enrollment set is unexpectedly large.");
    }
  }

  return rows;
}

export async function GET(request: NextRequest) {
  const token = tokenFrom(request);
  if (!token || !(await isAdmin(token))) {
    return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  }

  try {
    const [schoolYears, gradeLevels, sections] = await Promise.all([
      restJson(
        `${SUPABASE_URL}/rest/v1/school_years?select=id,name,start_year,end_year,is_active&order=start_year.desc`,
        token
      ),
      restJson(
        `${SUPABASE_URL}/rest/v1/grade_levels?select=grade_level,label,sort_order&order=sort_order.asc`,
        token
      ),
      restJson(
        `${SUPABASE_URL}/rest/v1/sections?select=id,grade_level,name,is_active,program_type,shs_program_code&order=grade_level.asc,name.asc`,
        token
      ),
    ]);

    const activeYear = (schoolYears ?? []).find(
      (year: { is_active?: boolean }) => year.is_active === true
    );

    const enrollments = activeYear?.id
      ? await restAllJson(
          `${SUPABASE_URL}/rest/v1/student_enrollments?school_year_id=eq.${encodeURIComponent(
            String(activeYear.id)
          )}&enrollment_status=eq.active&select=id,school_year_id,grade_level,section_id,enrollment_status&order=enrolled_at.desc`,
          token
        )
      : [];

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

  if (action === "add_school_year") {
    const startYear = Number(body?.startYear ?? 0);
    const endYear = startYear + 1;
    if (!Number.isInteger(startYear) || startYear < 2000 || startYear > 2100) {
      return NextResponse.json({ error: "Enter a valid school-year start year." }, { status: 400 });
    }

    const name = `${startYear}–${endYear}`;
    const response = await fetch(`${SUPABASE_URL}/rest/v1/school_years`, {
      method: "POST",
      headers: {
        ...headers(token),
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        name,
        start_year: startYear,
        end_year: endYear,
        is_active: false,
      }),
      cache: "no-store",
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detail = String(result?.message ?? result?.details ?? "").toLowerCase();
      return NextResponse.json(
        {
          error: detail.includes("duplicate")
            ? `School Year ${name} already exists.`
            : "Unable to create the school year.",
        },
        { status: response.status || 400 }
      );
    }

    return NextResponse.json({ ok: true, schoolYear: result?.[0] ?? null });
  }

  if (action === "activate_school_year") {
    const schoolYearId = String(body?.schoolYearId ?? "");
    if (!schoolYearId) {
      return NextResponse.json({ error: "Choose a school year." }, { status: 400 });
    }

    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/admin-learner-management`,
      {
        method: "POST",
        headers: headers(token),
        body: JSON.stringify({
          action: "activate_school_year",
          school_year_id: schoolYearId,
        }),
        cache: "no-store",
      }
    );

    const result = await response.json().catch(() => ({}));
    return NextResponse.json(result, { status: response.status });
  }

  if (action === "add_section") {
    const gradeLevel = Number(body?.gradeLevel ?? 0);
    const name = String(body?.name ?? "").trim().replace(/\s+/g, " ");

    const isAlsAe = gradeLevel === 0;
    const isRegularGrade = gradeLevel >= 7 && gradeLevel <= 12;
    const requestedProgramType = String(body?.programType ?? "").trim();
    if (!Number.isInteger(gradeLevel) || (!isAlsAe && !isRegularGrade)) {
      return NextResponse.json(
        { error: "Select a valid Grade Level or ALS A&E." },
        { status: 400 }
      );
    }

    if (name.length < 2 || name.length > 60) {
      return NextResponse.json(
        { error: "Section name must contain 2 to 60 characters." },
        { status: 400 }
      );
    }

    let programType: string | null = null;
    if (isAlsAe) {
      programType = "ALS A&E";
    } else if (gradeLevel === 11 || gradeLevel === 12) {
      if (!validShsProgramType(requestedProgramType)) {
        return NextResponse.json(
          { error: "Select Regular SHS or ALS-SHS for a Senior High section." },
          { status: 400 }
        );
      }
      programType = requestedProgramType;
    }

    const response = await fetch(`${SUPABASE_URL}/rest/v1/sections`, {
      method: "POST",
      headers: {
        ...headers(token),
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        grade_level: gradeLevel,
        name,
        is_active: true,
        program_type: programType,
      }),
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

    return NextResponse.json({
      ok: true,
      section: result?.[0] ?? null,
      levelLabel: isAlsAe ? "ALS A&E" : `Grade ${gradeLevel}`,
    });
  }

  if (action === "set_grade11_program") {
    const id = String(body?.id ?? "");
    const submittedCode = String(body?.programCode ?? "").trim();
    // Accept a cached old dropdown value without retaining a split section.
    const programCode = submittedCode === "STEM_MEDICAL" || submittedCode === "STEM_ENGINEERING" ? "STEM" : submittedCode;
    if (!id || (programCode && !GRADE11_PROGRAM_CODES.has(programCode))) {
      return NextResponse.json({ error: "Choose a valid Grade 11 section and program." }, { status: 400 });
    }
    const sections = await restJson(
      `${SUPABASE_URL}/rest/v1/sections?id=eq.${encodeURIComponent(id)}&select=id,grade_level,name&limit=1`,
      token
    );
    if (Number(sections?.[0]?.grade_level) !== 11) {
      return NextResponse.json({ error: "Program assignment is currently available only for Grade 11 sections." }, { status: 400 });
    }
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/sections?id=eq.${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        headers: { ...headers(token), Prefer: "return=representation" },
        body: JSON.stringify({
          shs_program_code: programCode || null,
          updated_at: new Date().toISOString(),
        }),
        cache: "no-store",
      }
    );
    const updated = await response.json().catch(() => []);
    if (!response.ok || !updated?.[0]) {
      return NextResponse.json({ error: "Unable to save the Grade 11 section program." }, { status: 400 });
    }
    return NextResponse.json({
      ok: true,
      section: updated[0],
      message: "Section program saved. SF9 will use the matching configured electives.",
    });
  }

  if (action === "set_section_program_type") {
    const id = String(body?.id ?? "");
    const programType = String(body?.programType ?? "").trim();
    if (!id || !validShsProgramType(programType)) {
      return NextResponse.json(
        { error: "Choose a Senior High section and a valid Program Type." },
        { status: 400 }
      );
    }

    const rows = await restJson(
      `${SUPABASE_URL}/rest/v1/sections?id=eq.${encodeURIComponent(
        id
      )}&select=id,grade_level,name&limit=1`,
      token
    ).catch(() => []);

    const section = rows?.[0];
    if (!section || ![11, 12].includes(Number(section.grade_level))) {
      return NextResponse.json(
        { error: "Program Type can only be changed for Grade 11 or Grade 12 sections." },
        { status: 400 }
      );
    }

    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/sections?id=eq.${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        headers: {
          ...headers(token),
          Prefer: "return=representation",
        },
        body: JSON.stringify({
          program_type: programType,
          updated_at: new Date().toISOString(),
        }),
        cache: "no-store",
      }
    );

    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result?.[0]) {
      return NextResponse.json(
        { error: "Unable to update the section Program Type." },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: true, section: result[0] });
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
