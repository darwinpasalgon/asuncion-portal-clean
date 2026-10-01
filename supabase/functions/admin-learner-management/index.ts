import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.116.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

type LearnerStatus =
  | "active"
  | "transferred_in"
  | "transferred_out"
  | "dropped"
  | "graduated"
  | "retained"
  | "archived";

const learnerStatuses = new Set<LearnerStatus>([
  "active",
  "transferred_in",
  "transferred_out",
  "dropped",
  "graduated",
  "retained",
  "archived",
]);

function enrollmentStatusFor(status: LearnerStatus) {
  if (status === "active" || status === "transferred_in") return "active";
  if (status === "transferred_out") return "transferred";
  if (status === "dropped") return "withdrawn";
  return "completed";
}

function eventTypeFor(status: LearnerStatus) {
  if (status === "active") return "status_changed";
  return status;
}

function clean(value: unknown) {
  return String(value ?? "").trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceRole) {
    return json({ error: "Learner management service unavailable." }, 500);
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) return json({ error: "Unauthorized." }, 401);

  const admin = createClient(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: authCaller, error: callerError } = await admin.auth.getUser(token);
  const callerId = authCaller?.user?.id ?? "";
  if (callerError || !callerId) return json({ error: "Unauthorized." }, 401);

  const { data: caller } = await admin
    .from("profiles")
    .select("role,account_status,admin_role")
    .eq("id", callerId)
    .maybeSingle();

  if (
    !caller ||
    caller.role !== "administrator" ||
    caller.account_status !== "active" ||
    caller.admin_role !== "super_administrator"
  ) {
    return json({ error: "Super Administrator access required." }, 403);
  }

  const body = await req.json().catch(() => ({}));
  const action = clean(body.action) || "list";

  if (action === "list") {
    const [
      profilesResult,
      infoResult,
      enrollmentResult,
      yearsResult,
      sectionsResult,
      adviserResult,
      teacherResult,
      eventResult,
    ] = await Promise.all([
      admin
        .from("profiles")
        .select("id,full_name,lrn,recovery_phone,account_status,grade_level,section,created_at")
        .eq("role", "student")
        .order("full_name"),
      admin.from("learner_information").select("*"),
      admin
        .from("student_enrollments")
        .select(
          "id,student_id,school_year_id,grade_level,section_id,enrollment_status,learner_status,status_note,status_changed_at,enrolled_at,source_enrollment_id"
        )
        .order("enrolled_at", { ascending: false }),
      admin
        .from("school_years")
        .select("id,name,start_year,end_year,is_active")
        .order("start_year"),
      admin
        .from("sections")
        .select("id,grade_level,name,is_active")
        .order("grade_level")
        .order("name"),
      admin
        .from("section_advisers")
        .select("school_year_id,section_id,teacher_id,is_active")
        .eq("is_active", true),
      admin
        .from("profiles")
        .select("id,full_name")
        .eq("role", "teacher"),
      admin
        .from("learner_enrollment_events")
        .select(
          "id,student_id,school_year_id,enrollment_id,event_type,from_grade_level,from_section_id,to_grade_level,to_section_id,from_status,to_status,note,created_at"
        )
        .order("created_at", { ascending: false }),
    ]);

    const firstError =
      profilesResult.error ||
      infoResult.error ||
      enrollmentResult.error ||
      yearsResult.error ||
      sectionsResult.error ||
      adviserResult.error ||
      teacherResult.error ||
      eventResult.error;

    if (firstError) {
      return json({ error: "Unable to load learner management data.", detail: firstError.message }, 500);
    }

    const infos = new Map(
      (infoResult.data ?? []).map((item) => [String(item.student_id), item])
    );
    const sections = sectionsResult.data ?? [];
    const sectionMap = new Map(sections.map((item) => [String(item.id), item]));
    const years = yearsResult.data ?? [];
    const yearMap = new Map(years.map((item) => [String(item.id), item]));
    const teacherMap = new Map(
      (teacherResult.data ?? []).map((item) => [String(item.id), String(item.full_name ?? "")])
    );
    const adviserMap = new Map(
      (adviserResult.data ?? []).map((item) => [
        `${item.school_year_id}:${item.section_id}`,
        teacherMap.get(String(item.teacher_id)) ?? "Assigned adviser",
      ])
    );

    const enrollmentsByStudent = new Map<string, Array<Record<string, unknown>>>();
    for (const enrollment of enrollmentResult.data ?? []) {
      const section = enrollment.section_id
        ? sectionMap.get(String(enrollment.section_id))
        : null;
      const year = yearMap.get(String(enrollment.school_year_id));
      const item = {
        ...enrollment,
        school_year: year?.name ?? "",
        school_year_start: year?.start_year ?? null,
        school_year_end: year?.end_year ?? null,
        school_year_is_active: Boolean(year?.is_active),
        section: section?.name ?? "",
        adviser_name: enrollment.section_id
          ? adviserMap.get(`${enrollment.school_year_id}:${enrollment.section_id}`) ?? ""
          : "",
      };
      const key = String(enrollment.student_id);
      const list = enrollmentsByStudent.get(key) ?? [];
      list.push(item);
      enrollmentsByStudent.set(key, list);
    }

    const eventsByStudent = new Map<string, Array<Record<string, unknown>>>();
    for (const event of eventResult.data ?? []) {
      const item = {
        ...event,
        school_year: event.school_year_id
          ? yearMap.get(String(event.school_year_id))?.name ?? ""
          : "",
        from_section: event.from_section_id
          ? sectionMap.get(String(event.from_section_id))?.name ?? ""
          : "",
        to_section: event.to_section_id
          ? sectionMap.get(String(event.to_section_id))?.name ?? ""
          : "",
      };
      const key = String(event.student_id);
      const list = eventsByStudent.get(key) ?? [];
      list.push(item);
      eventsByStudent.set(key, list);
    }

    const learners = (profilesResult.data ?? []).map((profile) => ({
      ...profile,
      learner_info: infos.get(String(profile.id)) ?? null,
      enrollments: enrollmentsByStudent.get(String(profile.id)) ?? [],
      events: eventsByStudent.get(String(profile.id)) ?? [],
    }));

    return json({
      ok: true,
      learners,
      sections,
      school_years: years,
      active_year: years.find((item) => item.is_active) ?? null,
    });
  }

  if (action === "update_status") {
    const enrollmentId = clean(body.enrollment_id);
    const requestedStatus = clean(body.learner_status) as LearnerStatus;
    const note = clean(body.note);

    if (!enrollmentId || !learnerStatuses.has(requestedStatus)) {
      return json({ error: "Choose a valid learner status." }, 400);
    }

    const { data: enrollment, error: enrollmentError } = await admin
      .from("student_enrollments")
      .select(
        "id,student_id,school_year_id,grade_level,section_id,enrollment_status,learner_status"
      )
      .eq("id", enrollmentId)
      .maybeSingle();

    if (enrollmentError || !enrollment) {
      return json({ error: "Enrollment record not found." }, 404);
    }

    if (requestedStatus === "graduated" && Number(enrollment.grade_level) !== 12) {
      return json({ error: "Only Grade 12 learners can be marked Graduated." }, 400);
    }

    const nextEnrollmentStatus = enrollmentStatusFor(requestedStatus);
    const changedAt = new Date().toISOString();

    const { error: updateError } = await admin
      .from("student_enrollments")
      .update({
        enrollment_status: nextEnrollmentStatus,
        learner_status: requestedStatus,
        status_note: note || null,
        status_changed_at: changedAt,
        status_changed_by: callerId,
        updated_at: changedAt,
      })
      .eq("id", enrollmentId);

    if (updateError) {
      return json({ error: "Unable to update learner status.", detail: updateError.message }, 500);
    }

    await admin.from("learner_enrollment_events").insert({
      student_id: enrollment.student_id,
      school_year_id: enrollment.school_year_id,
      enrollment_id: enrollment.id,
      event_type: eventTypeFor(requestedStatus),
      from_grade_level: enrollment.grade_level,
      from_section_id: enrollment.section_id,
      to_grade_level: enrollment.grade_level,
      to_section_id: enrollment.section_id,
      from_status: enrollment.learner_status ?? "active",
      to_status: requestedStatus,
      note: note || null,
      created_by: callerId,
    });

    return json({ ok: true });
  }

  if (action === "move_section") {
    const enrollmentId = clean(body.enrollment_id);
    const targetSectionId = clean(body.target_section_id);
    const note = clean(body.note);

    if (!enrollmentId || !targetSectionId) {
      return json({ error: "Choose an enrollment and target section." }, 400);
    }

    const { data: enrollment } = await admin
      .from("student_enrollments")
      .select("id,student_id,school_year_id,grade_level,section_id,learner_status")
      .eq("id", enrollmentId)
      .maybeSingle();

    if (!enrollment) return json({ error: "Enrollment record not found." }, 404);

    const { data: targetSection } = await admin
      .from("sections")
      .select("id,grade_level,name,is_active")
      .eq("id", targetSectionId)
      .eq("grade_level", enrollment.grade_level)
      .eq("is_active", true)
      .maybeSingle();

    if (!targetSection) {
      return json({ error: "Choose an active section in the learner's current Grade Level." }, 400);
    }

    if (String(enrollment.section_id ?? "") === targetSectionId) {
      return json({ error: "The learner is already assigned to that section." }, 409);
    }

    const changedAt = new Date().toISOString();
    const { error: moveError } = await admin
      .from("student_enrollments")
      .update({
        section_id: targetSectionId,
        status_note: note || null,
        status_changed_at: changedAt,
        status_changed_by: callerId,
        updated_at: changedAt,
      })
      .eq("id", enrollmentId);

    if (moveError) {
      return json({ error: "Unable to move the learner to the selected section." }, 500);
    }

    const { data: year } = await admin
      .from("school_years")
      .select("is_active")
      .eq("id", enrollment.school_year_id)
      .maybeSingle();

    if (year?.is_active) {
      await admin
        .from("profiles")
        .update({
          grade_level: enrollment.grade_level,
          section: targetSection.name,
          updated_at: changedAt,
        })
        .eq("id", enrollment.student_id);
    }

    await admin.from("learner_enrollment_events").insert({
      student_id: enrollment.student_id,
      school_year_id: enrollment.school_year_id,
      enrollment_id: enrollment.id,
      event_type: "section_changed",
      from_grade_level: enrollment.grade_level,
      from_section_id: enrollment.section_id,
      to_grade_level: enrollment.grade_level,
      to_section_id: targetSectionId,
      from_status: enrollment.learner_status ?? "active",
      to_status: enrollment.learner_status ?? "active",
      note: note || null,
      created_by: callerId,
    });

    return json({ ok: true });
  }

  if (action === "activate_school_year") {
    const schoolYearId = clean(body.school_year_id);
    if (!schoolYearId) {
      return json({ error: "Choose a school year to activate." }, 400);
    }

    const { data: targetYear } = await admin
      .from("school_years")
      .select("id,name,start_year,end_year,is_active")
      .eq("id", schoolYearId)
      .maybeSingle();

    if (!targetYear) return json({ error: "School year not found." }, 404);
    if (targetYear.is_active) return json({ ok: true, synced_profiles: 0 });

    const { data: previousActive } = await admin
      .from("school_years")
      .select("id,start_year")
      .eq("is_active", true)
      .maybeSingle();

    if (
      previousActive?.id &&
      Number(targetYear.start_year) < Number(previousActive.start_year)
    ) {
      return json({ error: "A historical school year cannot replace the current active school year." }, 400);
    }

    if (previousActive?.id) {
      const { error: closeError } = await admin
        .from("school_years")
        .update({ is_active: false })
        .eq("id", previousActive.id);

      if (closeError) {
        return json({ error: "Unable to close the current active school year." }, 500);
      }
    }

    const { error: activateError } = await admin
      .from("school_years")
      .update({ is_active: true })
      .eq("id", schoolYearId);

    if (activateError) {
      if (previousActive?.id) {
        await admin.from("school_years").update({ is_active: true }).eq("id", previousActive.id);
      }
      return json({ error: "Unable to activate the selected school year." }, 500);
    }

    const [{ data: activeEnrollments, error: enrollmentError }, { data: activeSections }] =
      await Promise.all([
        admin
          .from("student_enrollments")
          .select("student_id,grade_level,section_id")
          .eq("school_year_id", schoolYearId)
          .eq("enrollment_status", "active"),
        admin.from("sections").select("id,name"),
      ]);

    if (enrollmentError) {
      return json({
        error: "The school year was activated, but learner profiles could not be synchronized.",
      }, 500);
    }

    const sectionMap = new Map(
      (activeSections ?? []).map((section) => [String(section.id), String(section.name ?? "")])
    );

    let syncedProfiles = 0;
    for (const enrollment of activeEnrollments ?? []) {
      const { error: profileError } = await admin
        .from("profiles")
        .update({
          grade_level: enrollment.grade_level,
          section: enrollment.section_id
            ? sectionMap.get(String(enrollment.section_id)) ?? null
            : null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", enrollment.student_id);

      if (!profileError) syncedProfiles += 1;
    }

    return json({ ok: true, synced_profiles: syncedProfiles, school_year: targetYear.name });
  }

  if (action === "transition") {
    const transitionType = clean(body.transition_type);
    const sourceYearId = clean(body.source_school_year_id);
    const targetYearId = clean(body.target_school_year_id);
    const targetGradeLevel = Number(body.target_grade_level ?? 0);
    const targetSectionId = clean(body.target_section_id);
    const studentIds = Array.isArray(body.student_ids)
      ? body.student_ids.map((item: unknown) => clean(item)).filter(Boolean)
      : [];
    const note = clean(body.note);

    if (!["promoted", "retained", "graduated"].includes(transitionType)) {
      return json({ error: "Choose Promote, Retain, or Graduate." }, 400);
    }
    if (!sourceYearId || !studentIds.length || studentIds.length > 200) {
      return json({ error: "Select between 1 and 200 learners from one school year." }, 400);
    }

    const { data: sourceYear } = await admin
      .from("school_years")
      .select("id,name,start_year,end_year,is_active")
      .eq("id", sourceYearId)
      .maybeSingle();

    if (!sourceYear) return json({ error: "Source school year not found." }, 404);

    let targetYear: Record<string, unknown> | null = null;
    let targetSection: Record<string, unknown> | null = null;

    if (transitionType !== "graduated") {
      if (!targetYearId || !Number.isInteger(targetGradeLevel) || !targetSectionId) {
        return json({ error: "Choose the target school year, grade level, and section." }, 400);
      }

      const { data: year } = await admin
        .from("school_years")
        .select("id,name,start_year,end_year,is_active")
        .eq("id", targetYearId)
        .maybeSingle();

      if (!year || Number(year.start_year) <= Number(sourceYear.start_year)) {
        return json({ error: "The target school year must be later than the source school year." }, 400);
      }
      targetYear = year;

      const { data: section } = await admin
        .from("sections")
        .select("id,grade_level,name,is_active")
        .eq("id", targetSectionId)
        .eq("grade_level", targetGradeLevel)
        .eq("is_active", true)
        .maybeSingle();

      if (!section) {
        return json({ error: "Choose an active section for the target Grade Level." }, 400);
      }
      targetSection = section;
    }

    const successes: Array<Record<string, unknown>> = [];
    const failures: Array<Record<string, unknown>> = [];

    for (const studentId of studentIds) {
      const { data: sourceEnrollment } = await admin
        .from("student_enrollments")
        .select(
          "id,student_id,school_year_id,grade_level,section_id,enrollment_status,learner_status"
        )
        .eq("student_id", studentId)
        .eq("school_year_id", sourceYearId)
        .maybeSingle();

      if (!sourceEnrollment) {
        failures.push({ student_id: studentId, error: "No source enrollment was found." });
        continue;
      }

      if (!["active", "completed"].includes(String(sourceEnrollment.enrollment_status))) {
        failures.push({
          student_id: studentId,
          error: "Transferred or withdrawn learners cannot be promoted, retained, or graduated.",
        });
        continue;
      }

      if (transitionType === "graduated") {
        if (Number(sourceEnrollment.grade_level) !== 12) {
          failures.push({ student_id: studentId, error: "Only Grade 12 learners can be marked Graduated." });
          continue;
        }

        const changedAt = new Date().toISOString();
        const { error: graduationError } = await admin
          .from("student_enrollments")
          .update({
            enrollment_status: "completed",
            learner_status: "graduated",
            status_note: note || null,
            status_changed_at: changedAt,
            status_changed_by: callerId,
            updated_at: changedAt,
          })
          .eq("id", sourceEnrollment.id);

        if (graduationError) {
          failures.push({ student_id: studentId, error: "Unable to mark learner Graduated." });
          continue;
        }

        await admin.from("learner_enrollment_events").insert({
          student_id: studentId,
          school_year_id: sourceYearId,
          enrollment_id: sourceEnrollment.id,
          event_type: "graduated",
          from_grade_level: sourceEnrollment.grade_level,
          from_section_id: sourceEnrollment.section_id,
          to_grade_level: sourceEnrollment.grade_level,
          to_section_id: sourceEnrollment.section_id,
          from_status: sourceEnrollment.learner_status ?? "active",
          to_status: "graduated",
          note: note || null,
          created_by: callerId,
        });

        successes.push({ student_id: studentId });
        continue;
      }

      const expectedGrade =
        transitionType === "promoted"
          ? Number(sourceEnrollment.grade_level) + 1
          : Number(sourceEnrollment.grade_level);

      if (expectedGrade !== targetGradeLevel || targetGradeLevel < 7 || targetGradeLevel > 12) {
        failures.push({
          student_id: studentId,
          error:
            transitionType === "promoted"
              ? `Target must be Grade ${Number(sourceEnrollment.grade_level) + 1}.`
              : `Retained learners must remain in Grade ${sourceEnrollment.grade_level}.`,
        });
        continue;
      }

      const { data: existingTarget } = await admin
        .from("student_enrollments")
        .select("id")
        .eq("student_id", studentId)
        .eq("school_year_id", targetYearId)
        .maybeSingle();

      if (existingTarget) {
        failures.push({ student_id: studentId, error: "A target school-year enrollment already exists." });
        continue;
      }

      const { data: targetEnrollment, error: targetError } = await admin
        .from("student_enrollments")
        .insert({
          student_id: studentId,
          school_year_id: targetYearId,
          grade_level: targetGradeLevel,
          section_id: targetSectionId,
          enrollment_status: "active",
          learner_status: "active",
          source_enrollment_id: sourceEnrollment.id,
          created_by: callerId,
          updated_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (targetError || !targetEnrollment) {
        failures.push({ student_id: studentId, error: "Unable to create the target enrollment." });
        continue;
      }

      const changedAt = new Date().toISOString();
      const sourceLearnerStatus = transitionType === "retained" ? "retained" : "active";

      const { error: sourceUpdateError } = await admin
        .from("student_enrollments")
        .update({
          enrollment_status: "completed",
          learner_status: sourceLearnerStatus,
          status_note: note || null,
          status_changed_at: changedAt,
          status_changed_by: callerId,
          updated_at: changedAt,
        })
        .eq("id", sourceEnrollment.id);

      if (sourceUpdateError) {
        await admin.from("student_enrollments").delete().eq("id", targetEnrollment.id);
        failures.push({ student_id: studentId, error: "The source enrollment could not be closed." });
        continue;
      }

      if (Boolean(targetYear?.is_active)) {
        await admin
          .from("profiles")
          .update({
            grade_level: targetGradeLevel,
            section: String(targetSection?.name ?? ""),
            updated_at: changedAt,
          })
          .eq("id", studentId);
      }

      await admin.from("learner_enrollment_events").insert({
        student_id: studentId,
        school_year_id: sourceYearId,
        enrollment_id: sourceEnrollment.id,
        event_type: transitionType,
        from_grade_level: sourceEnrollment.grade_level,
        from_section_id: sourceEnrollment.section_id,
        to_grade_level: targetGradeLevel,
        to_section_id: targetSectionId,
        from_status: sourceEnrollment.learner_status ?? "active",
        to_status: "active",
        note: note || null,
        created_by: callerId,
      });

      successes.push({ student_id: studentId, target_enrollment_id: targetEnrollment.id });
    }

    return json({
      ok: failures.length === 0,
      processed: studentIds.length,
      succeeded: successes.length,
      failed: failures.length,
      successes,
      errors: failures,
    }, failures.length && !successes.length ? 409 : 200);
  }

  return json({ error: "Unknown learner-management action." }, 400);
});
