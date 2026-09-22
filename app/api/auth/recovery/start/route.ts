import { NextResponse } from "next/server";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase-config";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/password-recovery-start`,
    {
      method: "POST",
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        identifier: body.identifier,
        channel: body.channel,
      }),
      cache: "no-store",
    }
  );

  const result = await response.json().catch(() => ({}));
  return NextResponse.json(result, { status: response.status });
}
