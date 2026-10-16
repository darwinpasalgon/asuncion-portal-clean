import { NextRequest, NextResponse } from "next/server";
import { hasAdminPermission } from "@/lib/admin-access";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase-config";
import { isStemGroup } from "@/lib/shs-stem-groups";

type Row = Record<string, unknown>;
const tokenFrom = (request: NextRequest) => request.cookies.get("anhs-access-token")?.value ?? "";
function authHeaders(token: string) {
  return {
    apikey: SUPABASE_PUBLISHABLE_KEY,
    Authorization: "Bearer " + token,
    "Content-Type": "application/json",
  };
}
async function getRows(url: string, token: string): Promise<Row[]> {
  const response = await fetch(SUPABASE_URL + "/rest/v1/" + url, {
    headers: authHeaders(token), cache: "no-store",
  });
  if (!response.ok) throw new Error("Unable to load STEM learner groups.");
  return response.json();
}
async function authorize(request: NextRequest) {
  const token = tokenFrom(request);
  return token && await hasAdminPermission(token, "school_setup.manage") ? token : "";
}

export async function GET(request: NextRequest) {
  const token = await authorize(request);
  if (!token) return NextResponse.json({ error: "School Setup administrator access required." }, { status: 403 });
  try {
    const [years, sections] = await Promise.all([
      getRows("school_years?is_active=eq.true&select=id,name&limit=1", token),
      getRows("sections?grade_level=eq.11&shs_program_code=eq.STEM&is_active=eq.true&select=id,name,grade_level&order=name.asc", token),
    ]);
    const year = years[0] ?? null;
    const sectionId = String(request.nextUrl.searchParams.get("sectionId") ?? "");
    if (!sectionId || !sections.some((section) => section.id === sectionId)) {
      return NextResponse.json({ year, sections, learners: [] });
    }
    const enrollments = year
      ? await getRows(
        "student_enrollments?school_year_id=eq." + encodeURIComponent(String(year.id)) +
        "&section_id=eq." + encodeURIComponent(sectionId) +
        "&enrollment_status=eq.active&select=id,student_id,shs_elective_group",
        token
      ) : [];
    const ids = enrollments.map((row) => String(row.student_id));
    const profiles = ids.length
      ? await getRows("profiles?id=in.(" + ids.join(",") + ")&select=id,full_name,lrn&role=eq.student", token)
      : [];
    const names = new Map(profiles.map((row) => [String(row.id), row]));
    const learners = enrollments.map((row) => ({
      enrollmentId: row.id,
      studentId: row.student_id,
      fullName: names.get(String(row.student_id))?.full_name ?? "Learner",
      lrn: names.get(String(row.student_id))?.lrn ?? null,
      group: row.shs_elective_group ?? "",
    })).sort((a,b) => String(a.fullName).localeCompare(String(b.fullName)));
    return NextResponse.json({ year, sections, learners });
  } catch {
    return NextResponse.json({ error: "Unable to load STEM sections and learners." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const token = await authorize(request);
  if (!token) return NextResponse.json({ error: "School Setup administrator access required." }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const sectionId = String(body.sectionId ?? "");
  const enrollmentId = String(body.enrollmentId ?? "");
  const group = String(body.group ?? "");
  if (!sectionId || !enrollmentId || (group !== "" && !isStemGroup(group))) {
    return NextResponse.json({ error: "Select a STEM learner and a valid elective group." }, { status: 400 });
  }
  try {
    const [years, sections] = await Promise.all([
      getRows("school_years?is_active=eq.true&select=id&limit=1", token),
      getRows("sections?id=eq." + encodeURIComponent(sectionId) +
        "&grade_level=eq.11&shs_program_code=eq.STEM&is_active=eq.true&select=id", token),
    ]);
    if (!years[0]?.id || !sections[0]?.id) {
      return NextResponse.json({ error: "Select an active Grade 11 STEM section." }, { status: 400 });
    }
    const response = await fetch(
      SUPABASE_URL + "/rest/v1/student_enrollments?id=eq." + encodeURIComponent(enrollmentId) +
      "&section_id=eq." + encodeURIComponent(sectionId) +
      "&school_year_id=eq." + encodeURIComponent(String(years[0].id)) +
      "&grade_level=eq.11&enrollment_status=eq.active",
      {
        method: "PATCH",
        headers: { ...authHeaders(token), Prefer: "return=representation" },
        body: JSON.stringify({ shs_elective_group: group || null }),
        cache: "no-store",
      }
    );
    const changed = await response.json().catch(() => []);
    if (!response.ok || !Array.isArray(changed) || changed.length !== 1) {
      return NextResponse.json({ error: "Unable to save the learner's STEM elective group." }, { status: 400 });
    }
    return NextResponse.json({ ok: true, group: changed[0].shs_elective_group ?? null });
  } catch {
    return NextResponse.json({ error: "Unable to update this STEM elective group." }, { status: 500 });
  }
}
