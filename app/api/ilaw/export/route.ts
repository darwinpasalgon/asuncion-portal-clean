import { NextRequest, NextResponse } from "next/server";
import { createIlawDocx } from "@/lib/ilaw-docx";
import { uuid, validateIlaw } from "@/lib/learning-workspaces";
import { LearningError, learningFailure, learningIdentity, learningRows } from "@/lib/learning-server";

export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  try {
    const { token, profile } = await learningIdentity(request);
    if (profile.role === "student") throw new LearningError("Lesson planning is available to teaching personnel.", 403);
    const id = uuid(request.nextUrl.searchParams.get("id"), "Lesson plan");
    const rows = await learningRows(`ilaw_lesson_plans?id=eq.${id}&select=*,owner:profiles!ilaw_lesson_plans_owner_id_fkey(full_name)&limit=1`, token);
    const row = rows[0];
    if (!row) throw new LearningError("This lesson plan is not available to your account.", 404);
    const plan = validateIlaw(row.content, row.status === "ready");
    const bytes = createIlawDocx(plan, row.owner?.full_name ?? profile.full_name, row.status);
    const name = plan.title.normalize("NFKD").replace(/[^a-zA-Z0-9_-]+/g, "-").slice(0,90) || "Lesson-Plan";
    return new NextResponse(new Uint8Array(bytes), { headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="ILAW-${name}.docx"`,
      "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
    }});
  } catch (error) { return learningFailure(error); }
}
