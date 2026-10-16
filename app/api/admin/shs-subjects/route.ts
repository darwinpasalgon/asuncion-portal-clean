import { NextRequest, NextResponse } from "next/server";
import { hasAdminPermission } from "@/lib/admin-access";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase-config";

const PROGRAMS = new Set([
  "STEM_MEDICAL", "STEM_ENGINEERING", "BUSINESS_ENTREPRENEURSHIP",
  "ASSH", "TVL_OAP", "TVL_FOOD_PROCESSING",
]);

type Json = Record<string, unknown>;

function headers(token: string, prefer?: string): Record<string, string> {
  return {
    apikey: SUPABASE_PUBLISHABLE_KEY,
    Authorization: "Bearer " + token,
    "Content-Type": "application/json",
    ...(prefer ? { Prefer: prefer } : {}),
  };
}

function tokenFrom(request: NextRequest) {
  return request.cookies.get("anhs-access-token")?.value ?? "";
}

async function query(path: string, token: string): Promise<Json[]> {
  const response = await fetch(SUPABASE_URL + "/rest/v1/" + path, {
    headers: headers(token), cache: "no-store",
  });
  if (!response.ok) throw new Error("Unable to retrieve SHS catalog records.");
  return response.json();
}

async function write(
  path: string, method: "POST" | "PATCH", payload: Json, token: string,
  prefer = "return=representation"
): Promise<Json[]> {
  const response = await fetch(SUPABASE_URL + "/rest/v1/" + path, {
    method, headers: headers(token, prefer), body: JSON.stringify(payload), cache: "no-store",
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    if (error?.code === "23505") throw new Error("This subject is already configured.");
    throw new Error("Unable to save SHS subjects. Check the subject name and permissions.");
  }
  if (response.status === 204) return [];
  return response.json();
}

async function allowed(request: NextRequest) {
  const token = tokenFrom(request);
  if (!token || !(await hasAdminPermission(token, "teaching.manage"))) return "";
  return token;
}

export async function GET(request: NextRequest) {
  const token = await allowed(request);
  if (!token) return NextResponse.json({ error: "Teaching setup administrator access required." }, { status: 403 });
  try {
    const yearRows = await query("school_years?is_active=eq.true&select=id,name&limit=1", token);
    const year = yearRows[0] ?? null;
    const [subjects, offerings] = await Promise.all([
      query("subjects?grade_level=in.(11,12)&select=id,grade_level,name,is_active,is_graded,include_in_school_forms&order=grade_level.asc,name.asc", token),
      year ? query(
        "shs_subject_offerings?school_year_id=eq." + encodeURIComponent(String(year.id)) +
        "&select=id,subject_id,grade_level,category,program_code,term_no,group_label,is_active&order=grade_level.asc,category.asc,term_no.asc",
        token
      ) : Promise.resolve([]),
    ]);
    return NextResponse.json({ year, subjects, offerings });
  } catch {
    return NextResponse.json({ error: "Unable to load the SHS subject setup." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const token = await allowed(request);
  if (!token) return NextResponse.json({ error: "Teaching setup administrator access required." }, { status: 403 });
  const body = await request.json().catch(() => null);
  const action = String(body?.action ?? "");
  try {
    const years = await query("school_years?is_active=eq.true&select=id,name&limit=1", token);
    const yearId = String(years[0]?.id ?? "");
    if (!yearId) return NextResponse.json({ error: "No active school year is configured." }, { status: 400 });

    if (action === "remove_offering") {
      const id = String(body?.id ?? "");
      if (!/^[a-f0-9-]{36}$/i.test(id)) {
        return NextResponse.json({ error: "Select a valid subject offering." }, { status: 400 });
      }
      const changed = await write(
        "shs_subject_offerings?id=eq." + encodeURIComponent(id) +
        "&school_year_id=eq." + encodeURIComponent(yearId),
        "PATCH", { is_active: false, updated_at: new Date().toISOString() }, token
      );
      if (!changed.length) return NextResponse.json({ error: "The offering was not found." }, { status: 404 });
      return NextResponse.json({ success: true, message: "Offering removed from this term. Existing grades and teacher assignments are unchanged." });
    }

    if (action !== "add_offering") {
      return NextResponse.json({ error: "Unsupported subject setup action." }, { status: 400 });
    }

    const grade = Number(body?.gradeLevel);
    const category = String(body?.category ?? "");
    const term = category === "core" ? 0 : Number(body?.termNo);
    const program = category === "core" ? "ALL" : String(body?.programCode ?? "");
    const groupLabel = category === "core" ? String(body?.groupLabel ?? "").trim().slice(0, 100) || null : null;
    if (![11, 12].includes(grade) || !["core", "elective"].includes(category) ||
        (category === "elective" && (!PROGRAMS.has(program) || !Number.isInteger(term) || term < 1 || term > (grade === 11 ? 3 : 2)))) {
      return NextResponse.json({ error: "Choose a valid grade, category, program, and term." }, { status: 400 });
    }

    const subjectId = String(body?.subjectId ?? "");
    const name = String(body?.name ?? "").trim().replace(/\s+/g, " ");
    const allSubjects = await query(
      "subjects?grade_level=eq." + grade +
      "&select=id,name,grade_level,is_active,is_graded,include_in_school_forms",
      token
    );
    let subject = subjectId
      ? allSubjects.find((row) => row.id === subjectId)
      : allSubjects.find((row) => String(row.name ?? "").toLocaleLowerCase() === name.toLocaleLowerCase());

    if (subjectId && !subject) return NextResponse.json({ error: "The selected subject is not available in this grade." }, { status: 400 });
    if (!subject && (name.length < 2 || name.length > 100)) {
      return NextResponse.json({ error: "Enter a subject name between 2 and 100 characters." }, { status: 400 });
    }
    if ((subject && !subject.is_graded) || /^ARAL(?:\s|$)|^HGP$/i.test(String(subject?.name ?? name))) {
      return NextResponse.json({ error: "ARAL and HGP are non-graded teaching loads, not academic or elective offerings." }, { status: 400 });
    }

    if (!subject) {
      const added = await write(
        "subjects?select=id,name,grade_level,is_active,is_graded", "POST",
        { grade_level: grade, name, code: null, is_active: true,
          grading_scheme: "shs_core_academic", is_graded: true, include_in_school_forms: true },
        token
      );
      subject = added[0];
    } else if (!subject.is_active) {
      await write("subjects?id=eq." + encodeURIComponent(String(subject.id)), "PATCH", { is_active: true }, token);
    }

    if (!subject?.id) throw new Error("The subject could not be created.");

    await write(
      "shs_subject_offerings?on_conflict=school_year_id,subject_id,program_code,term_no",
      "POST",
      {
        school_year_id: yearId,
        subject_id: subject.id,
        grade_level: grade,
        category,
        program_code: program,
        term_no: term,
        group_label: groupLabel,
        is_active: true,
        updated_at: new Date().toISOString(),
      },
      token,
      "resolution=merge-duplicates,return=representation"
    );
    return NextResponse.json({ success: true, message: "Subject added to the selected SHS group and term." });
  } catch (error) {
    console.error("SHS subject setup failed", error instanceof Error ? error.message : "Unknown failure");
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update SHS subjects." },
      { status: 500 }
    );
  }
}
