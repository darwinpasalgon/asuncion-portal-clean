import { NextRequest, NextResponse } from "next/server";
import { getScopedAdminAccess, isSuperAdministrator } from "@/lib/admin-access";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "@/lib/supabase-config";

const YEAR = "2026–2027";
const authHeaders = (token: string) => ({
  apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json",
});
function tokenFrom(request: NextRequest) { return request.cookies.get("anhs-access-token")?.value ?? ""; }
async function query<T = Record<string, unknown>>(path: string, token: string): Promise<T[]> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: authHeaders(token), cache: "no-store" });
  if (!response.ok) throw new Error(`Unable to read Grade 12 term schedules (${response.status}).`);
  return response.json();
}
type Period = {
  id: string; section_id: string; term_no: number; day_of_week: number; start_time: string;
  end_time: string; subject_label: string; instructor_label: string; instructor_ids: string[];
  needs_review: boolean; review_reason: string | null; source_sheet: string; source_row: number;
  source_file: string;
};
const select = "id,section_id,term_no,day_of_week,start_time,end_time,subject_label,instructor_label,instructor_ids,needs_review,review_reason,source_sheet,source_row,source_file";

async function context(request: NextRequest) {
  const token = tokenFrom(request);
  if (!token) return null;
  const access = await getScopedAdminAccess(token, "schedules.manage");
  if (!access.allowed || (access.gradeLevel !== null && access.gradeLevel !== 12)) return null;
  return { token, access };
}
export async function GET(request: NextRequest) {
  const info = await context(request);
  if (!info) return NextResponse.json({ error: "Grade 12 schedule administration access required." }, { status: 403 });
  try {
    const [years, sections, teachers, canProvision] = await Promise.all([
      query<{id:string;name:string}>("school_years?is_active=eq.true&select=id,name&limit=1", info.token),
      query<{id:string;name:string}>("sections?grade_level=eq.12&is_active=eq.true&select=id,name&order=name.asc", info.token),
      query<{id:string;full_name:string;email:string}>("profiles?role=eq.teacher&account_status=eq.active&select=id,full_name,email&order=full_name.asc", info.token),
      isSuperAdministrator(info.token),
    ]);
    if (!years[0] || !years[0].name.includes("2026")) {
      return NextResponse.json({ error: "The uploaded Grade 12 programs belong to SY 2026–2027." }, { status: 409 });
    }
    const periods = await query<Period>(
      `grade12_term_periods?school_year_id=eq.${encodeURIComponent(years[0].id)}&select=${select}&order=term_no.asc,day_of_week.asc,start_time.asc&limit=1000`,
      info.token
    );
    return NextResponse.json({ schoolYear: YEAR, sections, teachers, periods, readOnly: false, canProvision });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load Grade 12 term schedules." }, { status: 500 });
  }
}
export async function POST(request: NextRequest) {
  const info = await context(request);
  if (!info) return NextResponse.json({ error: "Grade 12 schedule edit access required." }, { status: 403 });
  const body = await request.json().catch(() => null);
  if (body?.action === "link_jane_bardon") {
    if (!await isSuperAdministrator(info.token)) {
      return NextResponse.json({ error: "Super Administrator permission required." }, { status: 403 });
    }
    const janeEmail = "jane.bardon.2026@temp.asuncion-nhs.invalid";
    const [jane] = await query<{id:string;full_name:string;role:string}>(
      `profiles?email=eq.${encodeURIComponent(janeEmail)}&role=eq.teacher&account_status=eq.active&select=id,full_name,role&limit=1`,
      info.token
    );
    if (!jane || jane.full_name.trim().toUpperCase() !== "JANE BARDON") {
      return NextResponse.json({ error: "Jane Bardon's teaching account has not been created. Use the Create Teacher Account action first." }, { status: 404 });
    }
    const [year] = await query<{id:string}>("school_years?is_active=eq.true&select=id&limit=1",info.token);
    if (!year) return NextResponse.json({error:"Active school year not found."},{status:409});
    const items = await query<Period>(
      `grade12_term_periods?school_year_id=eq.${year.id}&term_no=eq.2&instructor_label=eq.JANE%20BARDON&select=${select}&limit=50`,
      info.token
    );
    let linked = 0;
    for (const item of items) {
      if ((item.instructor_ids ?? []).includes(jane.id)) { linked++; continue; }
      if ((item.instructor_ids ?? []).length) {
        return NextResponse.json({error:"A Jane Bardon period is already assigned to a different teacher. Review manually."},{status:409});
      }
      const reasons = (item.review_reason??"").split(";").map(x=>x.trim())
        .filter(x=>x && !/Instructor missing from portal teacher accounts/i.test(x));
      const response = await fetch(`${SUPABASE_URL}/rest/v1/grade12_term_periods?id=eq.${encodeURIComponent(item.id)}`,{
        method:"PATCH",
        headers:{...authHeaders(info.token),Prefer:"return=representation"},
        body:JSON.stringify({instructor_ids:[jane.id],needs_review:reasons.length>0,review_reason:reasons.join("; ")||null}),
        cache:"no-store",
      });
      if (!response.ok) {
        return NextResponse.json({error:`Linked ${linked} of ${items.length} periods. Refresh and retry the remaining entries.`,linked},{status:409});
      }
      linked++;
    }
    return NextResponse.json({ok:true,linked,teacher_id:jane.id,message:`Jane Bardon linked to ${linked} Second Term Grade 12 periods.`});
  }
  if (!body || body.action !== "update_period") return NextResponse.json({ error: "Invalid action." }, { status: 400 });

  const id = String(body.id ?? "");
  const requestedSubject = String(body.subject_label ?? "").trim();
  const subject = /^ARAL(?:\s|$)/i.test(requestedSubject) ? "ARAL"
    : /^HGP\/ARAL(?:\s|$)/i.test(requestedSubject) ? "HGP/ARAL"
    : requestedSubject;
  const teachers: string[] = Array.isArray(body.instructor_ids) ? Array.from(new Set<string>((body.instructor_ids as unknown[]).map((value) => String(value)))) : [];
  const start = String(body.start_time ?? "").slice(0, 5);
  const end = String(body.end_time ?? "").slice(0, 5);
  if (!/^[0-9a-f-]{36}$/i.test(id) || !subject || subject.length > 160 ||
      !/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end) ||
      start < "07:30" || end > "16:45" || start >= end ||
      teachers.some(t => !/^[0-9a-f-]{36}$/i.test(t)) || teachers.length > 3) {
    return NextResponse.json({ error: "Choose valid subject, teachers, and time (7:30 AM to 4:45 PM)." }, { status: 400 });
  }
  if (subject.includes("ORGANIC AGRICULTURE PRODUCTION/FOOD PROCESSING") && teachers.length !== 2) {
    return NextResponse.json({error:"Assign distinct Organic Agriculture Production and Food Processing teachers."},{status:400});
  }
  try {
    const [existing] = await query<Period>(`grade12_term_periods?id=eq.${encodeURIComponent(id)}&select=${select}&limit=1`, info.token);
    if (!existing) return NextResponse.json({ error: "Grade 12 period not found." }, { status: 404 });
    const available = await query<{id:string}>(`profiles?role=eq.teacher&account_status=eq.active&select=id&limit=1000`, info.token);
    const allowed = new Set(available.map(t=>t.id));
    if (teachers.some(t=>!allowed.has(t))) return NextResponse.json({ error: "Select only active teacher accounts." }, { status: 400 });
    const sameTerm = await query<Period>(
      `grade12_term_periods?term_no=eq.${existing.term_no}&day_of_week=eq.${existing.day_of_week}&select=${select}&limit=1000`,
      info.token
    );
    const conflicts = sameTerm.filter(p => p.id !== existing.id && p.section_id !== existing.section_id &&
      start < p.end_time.slice(0,5) && p.start_time.slice(0,5) < end &&
      teachers.some(t => (p.instructor_ids ?? []).includes(t)));
    // Editing text on an existing documented collision does not create a new one.
    const isChangingStaffOrTime = start !== existing.start_time.slice(0,5) || end !== existing.end_time.slice(0,5) ||
      teachers.slice().sort().join(",") !== (existing.instructor_ids ?? []).slice().sort().join(",");
    if (conflicts.length && isChangingStaffOrTime) {
      return NextResponse.json({ error: "Teacher schedule conflict within this term. Review the existing Grade 12 entries.", conflicts: conflicts.map(p=>({section_id:p.section_id,day:p.day_of_week,start:p.start_time,end:p.end_time,subject:p.subject_label})) }, { status: 409 });
    }
    const preservedNotes = (existing.review_reason ?? "").split(";").map(note => note.trim()).filter(note =>
      note && !/ends after (the )?4:30 PM|Instructor missing from portal teacher accounts|Instructor account not yet matched|Source timetable has overlapping teacher allocations/i.test(note)
    );
    const notes = [...preservedNotes,
      teachers.length === 0 ? "Instructor account not yet matched" : null,
      conflicts.length ? "Source timetable has overlapping teacher allocations" : null
    ].filter((note): note is string => Boolean(note));
    const response = await fetch(`${SUPABASE_URL}/rest/v1/grade12_term_periods?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH", headers: {...authHeaders(info.token),Prefer:"return=representation"},
      body: JSON.stringify({
        subject_label: subject, instructor_ids: teachers, start_time: start, end_time: end,
        needs_review: notes.length>0, review_reason: notes.join("; ") || null,
      }),
      cache: "no-store",
    });
    const result = await response.json().catch(()=>null);
    if (!response.ok || !Array.isArray(result) || !result[0]) {
      return NextResponse.json({ error: "Unable to save this term's class period. Verify your scheduling permission." }, { status: response.status >= 400 ? response.status : 500 });
    }
    return NextResponse.json({ ok:true, period:result[0], message:"Updated this Grade 12 term period. Other terms were not changed." });
  } catch (error) {
    return NextResponse.json({ error:error instanceof Error?error.message:"Could not update term period." }, { status:500 });
  }
}
