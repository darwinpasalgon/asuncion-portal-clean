import { NextRequest, NextResponse } from "next/server";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase-config";

function functionHeaders(token: string) {
  return {
    apikey: SUPABASE_PUBLISHABLE_KEY,
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

async function callSf10(token: string, body: Record<string, unknown>) {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/registrar-sf10`, {
    method: "POST",
    headers: functionHeaders(token),
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const result = await response.json().catch(() => ({}));
  return { response, result };
}

export async function GET(request: NextRequest) {
  const token = request.cookies.get("anhs-access-token")?.value ?? "";
  if (!token) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const studentId = request.nextUrl.searchParams.get("studentId") ?? "";
  const { response, result } = await callSf10(token, {
    action: studentId ? "detail" : "list",
    student_id: studentId,
  });

  if (studentId && response.ok) {
    return NextResponse.json(
      {
        ...result,
        permanentRecord: result.permanent_record ?? null,
        schoolInformation: result.school_information ?? null,
        scholasticRecords: result.scholastic_records ?? [],
        formType: result.form_type ?? "JHS",
      },
      { status: response.status }
    );
  }

  return NextResponse.json(result, { status: response.status });
}

export async function POST(request: NextRequest) {
  const token = request.cookies.get("anhs-access-token")?.value ?? "";
  if (!token) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const action = String(body.action ?? "");
  const payload =
    action === "save_profile"
      ? {
          ...body,
          student_id: String(body.studentId ?? ""),
        }
      : {
          action,
          student_id: String(body.studentId ?? ""),
          form_type: body.formType === "SHS" ? "SHS" : "JHS",
        };

  const { response, result } = await callSf10(token, payload);
  return NextResponse.json(result, { status: response.status });
}
