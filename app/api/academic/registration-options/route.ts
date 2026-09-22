import { NextResponse } from "next/server";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase-config";

async function getRows(path: string) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SUPABASE_PUBLISHABLE_KEY },
    cache: "no-store",
  });
  if (!response.ok) return null;
  return response.json().catch(() => []);
}

export async function GET() {
  const [grades, sections] = await Promise.all([
    getRows("grade_levels?select=grade_level,label,sort_order&order=sort_order.asc"),
    getRows("sections?is_active=eq.true&select=grade_level,name&order=grade_level.asc,name.asc"),
  ]);

  if (!grades || !sections) {
    return NextResponse.json(
      { error: "Unable to load grade and section choices." },
      { status: 500 }
    );
  }

  return NextResponse.json({ grades, sections });
}
