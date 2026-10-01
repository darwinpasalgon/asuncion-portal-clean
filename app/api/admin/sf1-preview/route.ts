import { Buffer } from "node:buffer";
import { NextRequest, NextResponse } from "next/server";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase-config";

function functionHeaders(token: string) {
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

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Choose an SF1 Excel file." }, { status: 400 });
  }

  if (!/\.(xls|xlsx)$/i.test(file.name)) {
    return NextResponse.json(
      { error: "Use the original SF1 Excel file in .xls or .xlsx format." },
      { status: 400 }
    );
  }

  if (file.size > 8 * 1024 * 1024) {
    return NextResponse.json({ error: "SF1 files must be 8 MB or smaller." }, { status: 400 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());

  const response = await fetch(`${SUPABASE_URL}/functions/v1/admin-sf1-preview`, {
    method: "POST",
    headers: functionHeaders(token),
    body: JSON.stringify({
      file_name: file.name,
      file_base64: bytes.toString("base64"),
    }),
    cache: "no-store",
  });

  const result = await response.json().catch(() => ({}));
  return NextResponse.json(result, { status: response.status });
}
