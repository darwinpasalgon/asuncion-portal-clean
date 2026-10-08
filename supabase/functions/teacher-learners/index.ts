import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.116.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

function sexRank(value: string | null) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "m" || normalized === "male") return 0;
  if (normalized === "f" || normalized === "female") return 1;
  return 2;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (!["GET", "POST"].includes(req.method)) {
    return json({ error: "Method not allowed." }, 405);
  }

  const url = Deno.env.get("SUPABASE_URL");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceRole) {
    return json({ error: "Teacher learner service unavailable." }, 500);
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) return json({ error: "Unauthorized." }, 401);

  const admin = createClient(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: authUser, error: authError } = await admin.auth.getUser(token);
  const userId = authUser?.user?.id ?? "";
  if (authError || !userId) return json({ error: "Unauthorized." }, 401);

  const { data: profile } = await admin
    .from("profiles")
    .select("id,role,account_status")
    .eq("id", userId)
    .maybeSingle();

  if (
    !profile ||
    profile.role !== "teacher" ||
    profile.account_status !== "active"
  ) {
    return json({ error: "Active Teacher access required." }, 403);
  }

  const { data: year } = await admin
    .from("school_years")
    .select("id,name")
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (!year) {
    return json({
      activeYear: null,
      sections: [],
      totalSections: 0,
      totalLearners: 0,
    });
  }

  const { data: assignmentRows, error: assignmentError } = await admin
    .from("teacher_assignments")
    .select("id,teacher_id,co_teacher_ids,grade_level,section_id,subject_id,major")
    .eq("school_year_id", year.id)
    .eq("is_active", true)
    .order("grade_level");

  const assignments = (assignmentRows ?? []).filter(
    (item) =>
      item.teacher_id === userId ||
      (item.co_teacher_ids ?? []).includes(userId)
  );

  if (assignmentError) {
    return json({ error: "Unable to load teaching assignments." }, 500);
  }

  if (!(assignments ?? []).length) {
    return json({
      activeYear: year,
      sections: [],
      totalSections: 0,
      totalLearners: 0,
    });
  }

  const sectionIds = Array.from(
    new Set((assignments ?? []).map((item) => String(item.section_id)))
  );
  const subjectIds = Array.from(
    new Set((assignments ?? []).map((item) => String(item.subject_id)))
  );

  const [{ data: sections }, { data: subjects }, { data: enrollments, error: enrollmentError }] =
    await Promise.all([
      admin
        .from("sections")
        .select("id,grade_level,name")
        .in("id", sectionIds)
        .order("grade_level")
        .order("name"),
      admin
        .from("subjects")
        .select("id,name,grade_level")
        .in("id", subjectIds),
      admin
        .from("student_enrollments")
        .select("id,student_id,grade_level,section_id,tve_major")
        .eq("school_year_id", year.id)
        .eq("enrollment_status", "active")
        .in("section_id", sectionIds),
    ]);

  if (enrollmentError) {
    return json({ error: "Unable to load assigned learners." }, 500);
  }

  const eligibleEnrollments = (enrollments ?? []).filter((enrollment) =>
    (assignments ?? []).some(
      (assignment) =>
        assignment.section_id === enrollment.section_id &&
        (!assignment.major || assignment.major === enrollment.tve_major)
    )
  );

  const studentIds = Array.from(
    new Set(eligibleEnrollments.map((item) => String(item.student_id)))
  );

  const [{ data: studentProfiles }, { data: learnerInformation }] =
    studentIds.length
      ? await Promise.all([
          admin
            .from("profiles")
            .select("id,full_name,lrn")
            .in("id", studentIds),
          admin
            .from("learner_information")
            .select(
              "student_id,last_name,first_name,middle_name,name_extension,sex"
            )
            .in("student_id", studentIds),
        ])
      : [{ data: [] }, { data: [] }];

  const profileMap = new Map(
    (studentProfiles ?? []).map((item) => [String(item.id), item])
  );
  const infoMap = new Map(
    (learnerInformation ?? []).map((item) => [String(item.student_id), item])
  );
  const sectionMap = new Map(
    (sections ?? []).map((item) => [String(item.id), item])
  );
  const subjectMap = new Map(
    (subjects ?? []).map((item) => [String(item.id), item])
  );

  const grouped = sectionIds
    .map((sectionId) => {
      const section = sectionMap.get(sectionId);
      if (!section) return null;

      const sectionAssignments = (assignments ?? []).filter(
        (item) => String(item.section_id) === sectionId
      );

      const rawSectionEnrollments = (enrollments ?? []).filter(
        (item) => String(item.section_id) === sectionId
      );
      const sectionLearners = eligibleEnrollments
        .filter((item) => String(item.section_id) === sectionId)
        .map((enrollment) => {
          const p = profileMap.get(String(enrollment.student_id));
          const info = infoMap.get(String(enrollment.student_id));
          return {
            student_id: enrollment.student_id,
            full_name: p?.full_name ?? "Unknown Learner",
            lrn: p?.lrn ?? null,
            last_name: info?.last_name ?? null,
            first_name: info?.first_name ?? null,
            middle_name: info?.middle_name ?? null,
            name_extension: info?.name_extension ?? null,
            sex: info?.sex ?? null,
          };
        })
        .sort((a, b) => {
          const bySex = sexRank(a.sex) - sexRank(b.sex);
          if (bySex !== 0) return bySex;
          const byLast = String(a.last_name ?? a.full_name).localeCompare(
            String(b.last_name ?? b.full_name),
            undefined,
            { sensitivity: "base" }
          );
          if (byLast !== 0) return byLast;
          return String(a.first_name ?? a.full_name).localeCompare(
            String(b.first_name ?? b.full_name),
            undefined,
            { sensitivity: "base" }
          );
        });

      const subjectsForSection = sectionAssignments
        .map((assignment) => {
          const subject = subjectMap.get(String(assignment.subject_id));
          return {
            assignment_id: assignment.id,
            subject: subject?.name ?? "Unknown Subject",
            major: assignment.major ?? null,
          };
        })
        .sort((a, b) => {
          const bySubject = a.subject.localeCompare(b.subject, undefined, {
            sensitivity: "base",
          });
          if (bySubject !== 0) return bySubject;
          return String(a.major ?? "").localeCompare(String(b.major ?? ""));
        });

      const hasMajorSpecificAssignment = sectionAssignments.some(
        (assignment) => Boolean(String(assignment.major ?? "").trim())
      );
      const pendingTveMajorCount = hasMajorSpecificAssignment
        ? rawSectionEnrollments.filter(
            (enrollment) => !String(enrollment.tve_major ?? "").trim()
          ).length
        : 0;

      return {
        id: section.id,
        grade_level: section.grade_level,
        name: section.name,
        learner_count: sectionLearners.length,
        section_enrollment_count: rawSectionEnrollments.length,
        pending_tve_major_count: pendingTveMajorCount,
        subjects: subjectsForSection,
        learners: sectionLearners,
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (a.grade_level !== b.grade_level) return a.grade_level - b.grade_level;
      return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    });

  return json({
    activeYear: year,
    sections: grouped,
    totalSections: grouped.length,
    totalLearners: new Set(
      eligibleEnrollments.map((item) => String(item.student_id))
    ).size,
  });
});
