import { Buffer } from "node:buffer";
import { NextRequest, NextResponse } from "next/server";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase-config";

function headers(token: string) {
  return {
    apikey: SUPABASE_PUBLISHABLE_KEY,
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

export async function POST(request: NextRequest) {
  const token = request.cookies.get("anhs-access-token")?.value ?? "";
  if (!token) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const contentType = request.headers.get("content-type") ?? "";
  let body: Record<string, unknown> = {};

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData().catch(() => null);
    const file = formData?.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Choose the Teacher Profile Excel workbook." }, { status: 400 });
    }

    if (!/\.(xls|xlsx)$/i.test(file.name)) {
      return NextResponse.json(
        { error: "Upload the original Teacher Profile workbook in .xls or .xlsx format." },
        { status: 400 }
      );
    }

    if (file.size > 3 * 1024 * 1024) {
      return NextResponse.json({ error: "Teacher Profile workbooks must be 3 MB or smaller." }, { status: 400 });
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    body = {
      action: "preview",
      file_name: file.name,
      file_base64: bytes.toString("base64"),
    };
  } else {
    body = (await request.json().catch(() => null)) ?? {};
  }

  const response = await fetch(`${SUPABASE_URL}/functions/v1/teacher-profiles`, {
    method: "POST",
    headers: headers(token),
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const result = await response.json().catch(() => ({}));
  return NextResponse.json(result, { status: response.status });
}
