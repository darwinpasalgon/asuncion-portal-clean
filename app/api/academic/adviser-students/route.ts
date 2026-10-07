import { NextRequest, NextResponse } from "next/server";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase-config";
import { TECHNICAL_VOCATIONAL_MAJORS } from "@/lib/subject-config";

function authHeaders(token: string) {
  return {
    apikey: SUPABASE_PUBLISHABLE_KEY,
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

async function getRows(path: string, token: string) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: authHeaders(token),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Query failed.");
  return response.json();
}

async function identity(request: NextRequest) {
  const token = request.cookies.get("anhs-access-token")?.value ?? "";
  if (!token) return null;

  const userResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: authHeaders(token),
    cache: "no-store",
  });
  if (!userResponse.ok) return null;

  const user = await userResponse.json().catch(() => null);
  const userId = String(user?.id ?? "");
  if (!userId) return null;

  const rows = await getRows(
    `profiles?id=eq.${encodeURIComponent(
      userId
    )}&select=id,role,account_status&limit=1`,
    token
  ).catch(() => []);

  const profile = rows?.[0];
  if (
    !profile ||
    profile.role !== "teacher" ||
    profile.account_status !== "active"
  ) {
    return null;
  }

  return { token, userId };
}

async function activeYear(token: string) {
  const rows = await getRows(
    "school_years?is_active=eq.true&select=id,name&limit=1",
    token
  );
  return rows?.[0] ?? null;
}

export async function GET(request: NextRequest) {
  const auth = await identity(request);
  if (!auth) {
    return NextResponse.json({ error: "Teacher access required." }, { status: 403 });
  }

  try {
    const year = await activeYear(auth.token);
    if (!year) {
      return NextResponse.json({
        activeYear: null,
        sections: [],
        learners: [],
        majors: TECHNICAL_VOCATIONAL_MAJORS,
      });
    }

    const adviserRows = await getRows(
      `section_advisers?teacher_id=eq.${encodeURIComponent(
        auth.userId
      )}&school_year_id=eq.${encodeURIComponent(
        year.id
      )}&is_active=eq.true&select=id,section_id`,
      auth.token
    );

    const advisedIds = new Set(
      (adviserRows ?? []).map((item: { section_id: string }) => item.section_id)
    );

    if (advisedIds.size === 0) {
      return NextResponse.json({
        activeYear: year,
        sections: [],
        learners: [],
        majors: TECHNICAL_VOCATIONAL_MAJORS,
      });
    }

    const [sections, enrollments, profiles, learnerInfos] = await Promise.all([
      getRows(
        "sections?is_active=eq.true&select=id,grade_level,name&order=grade_level.asc,name.asc",
        auth.token
      ),
      getRows(
        `student_enrollments?school_year_id=eq.${encodeURIComponent(
          year.id
        )}&enrollment_status=eq.active&select=id,student_id,grade_level,section_id,tve_major,learner_status&order=grade_level.asc,enrolled_at.asc`,
        auth.token
      ),
      getRows(
        "profiles?role=eq.student&account_status=eq.active&select=id,full_name,lrn&order=full_name.asc",
        auth.token
      ),
      getRows(
        "learner_information?select=student_id,last_name,first_name,middle_name,name_extension,sex,birth_date,mother_tongue,is_indigenous_peoples,ethnic_group,religion,cct_recipient,address_house_street_purok,address_barangay,address_municipality_city,address_province,father_name,mother_maiden_name,guardian_name,guardian_relationship,guardian_contact_number,learning_modality,remarks&order=last_name.asc,first_name.asc",
        auth.token
      ),
    ]);

    const eligibleSections = (sections ?? []).filter(
      (section: { id: string }) => advisedIds.has(section.id)
    );
    const eligibleSectionIds = new Set(
      eligibleSections.map((section: { id: string }) => section.id)
    );
    const profileMap = new Map(
      (profiles ?? []).map(
        (profile: { id: string; full_name: string; lrn: string | null }) => [
          profile.id,
          profile,
        ]
      )
    );
    const learnerInfoMap = new Map(
      (learnerInfos ?? []).map(
        (info: {
          student_id: string;
          last_name: string | null;
          first_name: string | null;
          sex: string | null;
        }) => [info.student_id, info]
      )
    );
    const sectionMap = new Map(
      eligibleSections.map(
        (section: { id: string; name: string }) => [section.id, section.name]
      )
    );

    const learners = (enrollments ?? [])
      .filter(
        (enrollment: { section_id: string | null; grade_level: number }) =>
          Boolean(enrollment.section_id) &&
          eligibleSectionIds.has(String(enrollment.section_id))
      )
      .map(
        (enrollment: {
          id: string;
          student_id: string;
          grade_level: number;
          section_id: string;
          tve_major: string | null;
          learner_status: string;
        }) => {
          const profile = profileMap.get(enrollment.student_id) as
            | { id: string; full_name: string; lrn: string | null }
            | undefined;
          const info = learnerInfoMap.get(enrollment.student_id) as
            | {
                student_id: string;
                last_name: string | null;
                first_name: string | null;
                middle_name: string | null;
                name_extension: string | null;
                sex: string | null;
                birth_date: string | null;
                mother_tongue: string | null;
                is_indigenous_peoples: boolean | null;
                ethnic_group: string | null;
                religion: string | null;
                cct_recipient: boolean | null;
                address_house_street_purok: string | null;
                address_barangay: string | null;
                address_municipality_city: string | null;
                address_province: string | null;
                father_name: string | null;
                mother_maiden_name: string | null;
                guardian_name: string | null;
                guardian_relationship: string | null;
                guardian_contact_number: string | null;
                learning_modality: string | null;
                remarks: string | null;
              }
            | undefined;
          return {
            enrollment_id: enrollment.id,
            student_id: enrollment.student_id,
            full_name: profile?.full_name ?? "Unknown learner",
            lrn: profile?.lrn ?? null,
            last_name: info?.last_name ?? null,
            first_name: info?.first_name ?? null,
            middle_name: info?.middle_name ?? null,
            name_extension: info?.name_extension ?? null,
            sex: info?.sex ?? null,
            birth_date: info?.birth_date ?? null,
            mother_tongue: info?.mother_tongue ?? null,
            is_indigenous_peoples: info?.is_indigenous_peoples ?? null,
            ethnic_group: info?.ethnic_group ?? null,
            religion: info?.religion ?? null,
            cct_recipient: info?.cct_recipient ?? null,
            address_house_street_purok: info?.address_house_street_purok ?? null,
            address_barangay: info?.address_barangay ?? null,
            address_municipality_city: info?.address_municipality_city ?? null,
            address_province: info?.address_province ?? null,
            father_name: info?.father_name ?? null,
            mother_maiden_name: info?.mother_maiden_name ?? null,
            guardian_name: info?.guardian_name ?? null,
            guardian_relationship: info?.guardian_relationship ?? null,
            guardian_contact_number: info?.guardian_contact_number ?? null,
            learning_modality: info?.learning_modality ?? null,
            remarks: info?.remarks ?? null,
            grade_level: enrollment.grade_level,
            section_id: enrollment.section_id,
            section: sectionMap.get(enrollment.section_id) ?? "Unknown section",
            tve_major: enrollment.tve_major ?? null,
            learner_status: enrollment.learner_status,
          };
        }
      )
      .sort(
        (
          a: {
            full_name: string;
            last_name: string | null;
            first_name: string | null;
            sex: string | null;
          },
          b: {
            full_name: string;
            last_name: string | null;
            first_name: string | null;
            sex: string | null;
          }
        ) => {
          const sexRank = (sex: string | null) => {
            const normalized = String(sex ?? "").trim().toUpperCase();
            if (normalized === "M") return 0;
            if (normalized === "F") return 1;
            return 2;
          };

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
        }
      );

    return NextResponse.json({
      activeYear: year,
      sections: eligibleSections,
      learners,
      majors: TECHNICAL_VOCATIONAL_MAJORS,
    });
  } catch {
    return NextResponse.json(
      { error: "Unable to load adviser learner records." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await identity(request);
  if (!auth) {
    return NextResponse.json({ error: "Teacher access required." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const action = String(body?.action ?? "");

  if (action === "update_learner_info") {
    const studentId = String(body?.studentId ?? "");
    const data =
      body?.data && typeof body.data === "object" && !Array.isArray(body.data)
        ? body.data
        : null;

    if (!studentId || !data) {
      return NextResponse.json(
        { error: "Learner and updated information are required." },
        { status: 400 }
      );
    }

    const allowedFields = new Set([
      "last_name",
      "first_name",
      "middle_name",
      "name_extension",
      "sex",
      "birth_date",
      "mother_tongue",
      "is_indigenous_peoples",
      "ethnic_group",
      "religion",
      "cct_recipient",
      "address_house_street_purok",
      "address_barangay",
      "address_municipality_city",
      "address_province",
      "father_name",
      "mother_maiden_name",
      "guardian_name",
      "guardian_relationship",
      "guardian_contact_number",
      "learning_modality",
      "remarks",
    ]);

    const safeData = Object.fromEntries(
      Object.entries(data as Record<string, unknown>).filter(([key]) =>
        allowedFields.has(key)
      )
    );

    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/rpc/update_adviser_student_information`,
      {
        method: "POST",
        headers: {
          ...authHeaders(auth.token),
          Prefer: "return=representation",
        },
        body: JSON.stringify({
          p_student_id: studentId,
          p_data: safeData,
        }),
        cache: "no-store",
      }
    );

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = String(result?.message ?? "").trim();
      return NextResponse.json(
        { error: message || "Unable to update learner information." },
        { status: response.status || 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      learnerInformation: Array.isArray(result) ? result[0] ?? null : result,
    });
  }

  if (action !== "set_tve_major") {
    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  }

  const enrollmentId = String(body?.enrollmentId ?? "");
  const rawMajor = String(body?.major ?? "").trim();
  const major = rawMajor || null;

  if (!enrollmentId) {
    return NextResponse.json({ error: "Learner enrollment is required." }, { status: 400 });
  }

  if (
    major &&
    !TECHNICAL_VOCATIONAL_MAJORS.includes(
      major as (typeof TECHNICAL_VOCATIONAL_MAJORS)[number]
    )
  ) {
    return NextResponse.json({ error: "Select a valid TVE Major." }, { status: 400 });
  }

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/rpc/set_adviser_student_tve_major`,
    {
      method: "POST",
      headers: {
        ...authHeaders(auth.token),
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        p_enrollment_id: enrollmentId,
        p_major: major,
      }),
      cache: "no-store",
    }
  );

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = String(result?.message ?? "").trim();
    return NextResponse.json(
      { error: message || "Unable to update the learner TVE Major." },
      { status: response.status || 400 }
    );
  }

  return NextResponse.json({
    ok: true,
    enrollment: Array.isArray(result) ? result[0] ?? null : result,
  });
}
