import { NextRequest } from "next/server";
import { integer, object, sameTutorClass, text, uuid, validateSupportPlan, validateSupportSession } from "@/lib/learning-workspaces";
import { LearningError, learningBody, learningFailure, learningIdentity, learningJson, learningRows } from "@/lib/learning-server";

async function allRows(path: string, token: string) {
  const result: Record<string, any>[] = [];
  for (let page = 0; page < 10; page++) {
    const rows = await learningRows(`${path}&limit=1000&offset=${page * 1000}`, token);
    result.push(...rows);
    if (rows.length < 1000) return result;
  }
  throw new LearningError("Too many records. Narrow the selected school year.");
}
async function supportPlan(id: string, token: string) {
  const rows = await learningRows(`aral_support_plans?id=eq.${id}&select=*&limit=1`, token);
  if (!rows[0]) throw new LearningError("This support plan is not available to your account.", 404);
  return rows[0];
}
async function adminContext(token: string) {
  const years = await learningRows("school_years?is_active=eq.true&select=id,name&limit=1", token);
  const year = years[0] ?? null;
  if (!year) return { year, learners: [], tutors: [], assignments: [], advisers: [] };
  const [enrollments, tutors, assignments, advisers] = await Promise.all([
    allRows(`student_enrollments?school_year_id=eq.${year.id}&enrollment_status=eq.active&learner_status=eq.active&grade_level=gte.7&grade_level=lte.10&select=student_id,grade_level,section_id,learner:profiles!student_enrollments_student_id_fkey(full_name),section:sections!student_enrollments_section_id_fkey(name)&order=grade_level.asc,student_id.asc`, token),
    allRows("profiles?role=eq.teacher&account_status=eq.active&select=id,full_name&order=full_name.asc,id.asc", token),
    allRows(`teacher_assignments?school_year_id=eq.${year.id}&is_active=eq.true&select=teacher_id,co_teacher_ids,section_id&order=id.asc`, token),
    allRows(`section_advisers?school_year_id=eq.${year.id}&is_active=eq.true&select=teacher_id,section_id&order=id.asc`, token),
  ]);
  const learners = enrollments.filter(e => e.learner?.full_name).map(e => ({ id: e.student_id, full_name: e.learner.full_name, grade_level: e.grade_level, section_id: e.section_id, section: e.section?.name ?? "" }));
  return { year, learners, tutors, assignments, advisers };
}
export async function GET(request: NextRequest) {
  try {
    const { token, profile } = await learningIdentity(request);
    if (request.nextUrl.searchParams.get("context") === "1") {
      if (profile.role !== "administrator") throw new LearningError("School administrator permission is required to assign ARAL support.", 403);
      return learningJson(await adminContext(token));
    }
    const id = request.nextUrl.searchParams.get("id");
    if (id) {
      uuid(id, "Support plan");
      const plan = await supportPlan(id, token);
      const sessions = await allRows(`aral_support_sessions?plan_id=eq.${id}&select=*&order=session_date.desc,id.asc`, token);
      const responses: Record<string, any>[] = [];
      for (let i = 0; i < sessions.length; i += 100) {
        const ids = sessions.slice(i, i + 100).map(s => uuid(s.id, "Session")).join(",");
        responses.push(...await learningRows(`aral_learner_responses?session_id=in.(${ids})&select=*`, token));
      }
      return learningJson({ plan, sessions, responses });
    }
    const page = integer(request.nextUrl.searchParams.get("page") ?? 0, "Page", 0, 10000);
    const archived = request.nextUrl.searchParams.get("archived") === "1";
    const plans = await learningRows(`aral_support_plans?select=*&status=${archived ? "eq" : "neq"}.archived&order=updated_at.desc,id.asc&limit=100&offset=${page * 100}`, token);
    return learningJson({ plans, page, hasMore: plans.length === 100 });
  } catch (error) { return learningFailure(error); }
}

export async function POST(request: NextRequest) {
  try {
    const { token, profile } = await learningIdentity(request);
    const body = object(await learningBody(request));
    if (body.action === "plan") {
      if (profile.role !== "administrator") throw new LearningError("School administrator permission is required to assign ARAL support.", 403);
      const data = validateSupportPlan(body.plan);
      const id = body.id ? uuid(body.id, "Support plan") : null;
      const previous = id ? await supportPlan(id, token) : null;
      if (previous && (previous.student_id !== data.student_id || previous.school_year_id !== data.school_year_id)) throw new LearningError("Keep recorded support with its original learner and school year. Create a separate plan for another learner.", 409);
      if (!previous || previous.student_id !== data.student_id || previous.tutor_id !== data.tutor_id || previous.school_year_id !== data.school_year_id) {
        const context = await adminContext(token);
        if (context.year?.id !== data.school_year_id) throw new LearningError("Choose the current school year.");
        const learner = context.learners.find(l => l.id === data.student_id);
        if (!learner || !context.tutors.some(t => t.id === data.tutor_id)) throw new LearningError("Select an active learner and teacher.");
        if (sameTutorClass(data.tutor_id, learner.section_id, context.assignments as any, context.advisers as any)) throw new LearningError("Choose a tutor who does not currently teach or advise this learner.");
      }
      if (id) {
        const expected = text(body.expected_updated_at, "Saved version", 64, true);
        const { student_id: _student, school_year_id: _year, ...changes } = data;
        const rows = await learningRows(`aral_support_plans?id=eq.${id}&updated_at=eq.${encodeURIComponent(expected)}`, token, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify(changes) });
        if (!rows[0]) throw new LearningError("This plan changed. Reopen it before saving.", 409);
        return learningJson({ plan: rows[0] });
      }
      const rows = await learningRows("aral_support_plans", token, { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({ ...data, created_by: profile.id }) });
      return learningJson({ plan: rows[0] }, 201);
    }
    if (body.action === "session") {
      if (profile.role === "student") throw new LearningError("Only the assigned tutor or school administrator can record session attendance and learning checks.", 403);
      const data = validateSupportSession(body.session);
      const plan = await supportPlan(data.plan_id, token);
      if (profile.role !== "administrator" && plan.tutor_id !== profile.id) throw new LearningError("This session belongs to another tutor.", 403);
      if (plan.status !== "active") throw new LearningError("The support plan must be active before sessions can be changed.", 409);
      if (body.id) {
        const id = uuid(body.id, "Session");
        const expected = text(body.expected_updated_at, "Saved version", 64, true);
        const { plan_id, ...changes } = data;
        const rows = await learningRows(`aral_support_sessions?id=eq.${id}&plan_id=eq.${plan_id}&updated_at=eq.${encodeURIComponent(expected)}`, token, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify(changes) });
        if (!rows[0]) throw new LearningError("The session changed or is unavailable. Reopen it before saving.", 409);
        return learningJson({ session: rows[0] });
      }
      const rows = await learningRows("aral_support_sessions", token, { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({ ...data, created_by: profile.id }) });
      return learningJson({ session: rows[0] }, 201);
    }
    if (body.action === "response") {
      if (profile.role !== "student") throw new LearningError("Learner responses must be submitted through the learner's own account.", 403);
      const id = uuid(body.session_id, "Session");
      const sessions = await learningRows(`aral_support_sessions?id=eq.${id}&select=id,plan_id&limit=1`, token);
      if (!sessions[0]) throw new LearningError("This activity is not available to your account.", 404);
      const plan = await supportPlan(sessions[0].plan_id, token);
      if (plan.student_id !== profile.id || plan.status !== "active") throw new LearningError("This activity is not open for your response.", 403);
      if (typeof body.completed !== "boolean" || typeof body.needs_help !== "boolean") throw new LearningError("Invalid activity status.");
      const payload = { message: text(body.message, "Your message", 5000), completed: body.completed, needs_help: body.needs_help };
      const existing = await learningRows(`aral_learner_responses?session_id=eq.${id}&select=session_id&limit=1`, token);
      const rows = await learningRows(existing[0] ? `aral_learner_responses?session_id=eq.${id}` : "aral_learner_responses", token, { method: existing[0] ? "PATCH" : "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(existing[0] ? payload : { ...payload, session_id: id, student_id: profile.id }) });
      return learningJson({ response: rows[0] });
    }
    throw new LearningError("Choose a valid support action.");
  } catch (error) { return learningFailure(error); }
}
