import { NextRequest } from "next/server";
import { integer, object, text, uuid, validateIlaw } from "@/lib/learning-workspaces";
import { LearningError, learningBody, learningFailure, learningIdentity, learningJson, learningRows } from "@/lib/learning-server";

export async function GET(request: NextRequest) {
  try {
    const { token, profile } = await learningIdentity(request);
    if (profile.role === "student") throw new LearningError("Lesson planning is available to teaching personnel.", 403);
    const id = request.nextUrl.searchParams.get("id");
    if (id) {
      uuid(id, "Lesson plan");
      const rows = await learningRows(`ilaw_lesson_plans?id=eq.${id}&select=*,owner:profiles!ilaw_lesson_plans_owner_id_fkey(full_name)&limit=1`, token);
      if (!rows[0]) throw new LearningError("This lesson plan is not available to your account.", 404);
      return learningJson({ plan: rows[0] });
    }
    const page = integer(request.nextUrl.searchParams.get("page") ?? 0, "Page", 0, 10000);
    const archived = request.nextUrl.searchParams.get("archived") === "1";
    const query = `ilaw_lesson_plans?select=id,title,subject,grade_level,term_no,week_no,status,owner_id,updated_at,owner:profiles!ilaw_lesson_plans_owner_id_fkey(full_name)&status=${archived ? "eq" : "neq"}.archived&order=updated_at.desc,id.asc&limit=30&offset=${page * 30}`;
    const plans = await learningRows(query, token);
    return learningJson({ plans, page, hasMore: plans.length === 30 });
  } catch (error) { return learningFailure(error); }
}

export async function POST(request: NextRequest) {
  try {
    const { token, profile } = await learningIdentity(request);
    if (profile.role === "student") throw new LearningError("Lesson planning is available to teaching personnel.", 403);
    const body = object(await learningBody(request));
    const status = String(body.status ?? "draft");
    if (!["draft", "ready", "archived"].includes(status)) throw new LearningError("Invalid plan status.");
    if (status === "ready" && body.teacher_reviewed !== true) throw new LearningError("Review the learning competencies, lesson activities, and assessment before marking this plan ready.");
    const content = validateIlaw(body.content, status === "ready");
    const payload = {
      title: content.title, subject: content.subject, grade_level: content.grade_level,
      term_no: content.term_no, week_no: content.week_no, content,
      status, teacher_reviewed: status === "ready" && body.teacher_reviewed === true,
    };
    if (body.id) {
      const id = uuid(body.id, "Lesson plan");
      const expected = text(body.expected_updated_at, "Saved version", 64, true);
      const rows = await learningRows(`ilaw_lesson_plans?id=eq.${id}&updated_at=eq.${encodeURIComponent(expected)}`, token, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify(payload) });
      if (!rows[0]) throw new LearningError("The plan changed or is unavailable. Reopen it before saving to avoid overwriting another edit.", 409);
      return learningJson({ plan: rows[0] });
    }
    const rows = await learningRows("ilaw_lesson_plans", token, { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({ ...payload, owner_id: profile.id }) });
    return learningJson({ plan: rows[0] }, 201);
  } catch (error) { return learningFailure(error); }
}
