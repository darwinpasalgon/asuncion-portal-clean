import { NextRequest } from "next/server";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase-config";
import { hasAdminPermission } from "@/lib/admin-access";

function headers(token: string) {
  return {
    apikey: SUPABASE_PUBLISHABLE_KEY,
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

async function isSuperAdmin(token: string) {
  return hasAdminPermission(token, "bulk_import.manage");
}

function csv(value: unknown) {
  return '"' + String(value ?? "").replace(/"/g, '""') + '"';
}

export async function POST(request: NextRequest) {
  const token = request.cookies.get("anhs-access-token")?.value ?? "";
  if (!token || !(await isSuperAdmin(token))) {
    return new Response("Bulk Account Import permission required.", { status: 403 });
  }

  const form = await request.formData();
  const gradeLevel = Number(form.get("grade_level") ?? 0);
  const section = String(form.get("section") ?? "").trim();

  if (!Number.isInteger(gradeLevel) || gradeLevel < 7 || gradeLevel > 12 || !section) {
    return new Response("Select a valid Grade Level and Section.", { status: 400 });
  }

  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/admin-user-management`,
    {
      method: "POST",
      headers: headers(token),
      body: JSON.stringify({
        action: "reset_section_temp_passwords",
        grade_level: gradeLevel,
        section,
      }),
      cache: "no-store",
    }
  );

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    return new Response(String(result.error ?? "Unable to generate new credentials."), {
      status: response.status,
    });
  }

  const accounts = Array.isArray(result.accounts) ? result.accounts : [];
  if (!accounts.length) {
    return new Response("No learner credentials were changed.", { status: 409 });
  }

  const output = [
    ["No.", "Learner Name", "LRN", "Temporary Password"].map(csv).join(","),
    ...accounts.map((item: Record<string, unknown>, index: number) =>
      [index + 1, item.full_name, item.lrn, item.temporary_password]
        .map(csv)
        .join(",")
    ),
  ].join("\r\n");

  const safeSection = section.replace(/[^A-Za-z0-9_-]+/g, "_");
  return new Response("\uFEFF" + output, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="ANHS_Grade_${gradeLevel}_${safeSection}_Temporary_Credentials.csv"`,
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
