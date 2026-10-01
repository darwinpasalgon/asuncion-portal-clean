import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.116.0";
import * as XLSX from "npm:xlsx@0.18.5";

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

function text(value: unknown) {
  return String(value ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function compact(value: unknown) {
  return text(value).toLowerCase().replace(/[^a-z0-9]/g, "");
}

function normalizeLrn(value: unknown) {
  return text(value).replace(/\D/g, "");
}

function normalizeContact(value: unknown) {
  const raw = text(value).replace(/[\s()-]/g, "");
  if (/^9\d{9}$/.test(raw)) return `0${raw}`;
  if (/^639\d{9}$/.test(raw)) return `+${raw}`;
  return text(value);
}

function findMetadata(rows: unknown[][], label: string) {
  const target = compact(label);
  for (const row of rows.slice(0, 20)) {
    for (let index = 0; index < row.length; index += 1) {
      if (compact(row[index]) !== target) continue;
      for (let next = index + 1; next < Math.min(row.length, index + 7); next += 1) {
        const candidate = text(row[next]);
        if (candidate) return candidate;
      }
    }
  }
  return "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceRole) {
    return json({ error: "SF1 import service unavailable." }, 500);
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) return json({ error: "Unauthorized." }, 401);

  const admin = createClient(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userResult, error: userError } = await admin.auth.getUser(token);
  const callerId = userResult?.user?.id ?? "";
  if (userError || !callerId) return json({ error: "Unauthorized." }, 401);

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
  const fileName = text(body.file_name);
  const fileBase64 = text(body.file_base64);

  if (!fileName || !/\.(xls|xlsx)$/i.test(fileName)) {
    return json({ error: "Upload an SF1 Excel file in .xls or .xlsx format." }, 400);
  }
  if (!fileBase64) {
    return json({ error: "The SF1 file is empty." }, 400);
  }

  try {
    const binary = atob(fileBase64);
    if (binary.length > 8 * 1024 * 1024) {
      return json({ error: "SF1 files must be 8 MB or smaller." }, 400);
    }

    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }

    const workbook = XLSX.read(bytes, {
      type: "array",
      cellDates: false,
      cellNF: false,
      cellText: true,
    });

    const sheetName = workbook.SheetNames[0] ?? "";
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) {
      return json({ error: "The SF1 workbook does not contain a readable worksheet." }, 400);
    }

    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      raw: false,
      defval: "",
      blankrows: false,
      dateNF: "mm/dd/yyyy",
    });

    const metadata = {
      school_id: findMetadata(rows, "School ID"),
      region: findMetadata(rows, "Region"),
      division: findMetadata(rows, "Division"),
      school_name: findMetadata(rows, "School Name"),
      school_year: findMetadata(rows, "School Year"),
      grade_level: findMetadata(rows, "Grade Level"),
      section: findMetadata(rows, "Section"),
    };

    const learners = rows
      .map((row, index) => {
        const lrn = normalizeLrn(row[0]);
        if (!/^\d{12}$/.test(lrn)) return null;

        return {
          source_row: index + 1,
          lrn,
          full_name: text(row[1]),
          sex: text(row[2]),
          birth_date: text(row[3]),
          mother_tongue: text(row[5]),
          ethnic_group: text(row[6]),
          religion: text(row[7]),
          address_house_street_purok: text(row[8]),
          address_barangay: text(row[9]),
          address_municipality_city: text(row[10]),
          address_province: text(row[11]),
          father_name: text(row[12]),
          mother_maiden_name: text(row[13]),
          guardian_name: text(row[14]),
          guardian_relationship: text(row[15]),
          mobile: normalizeContact(row[16]),
          learning_modality: text(row[17]),
          remarks: text(row[18]),
        };
      })
      .filter(Boolean);

    if (!learners.length) {
      return json(
        {
          error:
            "No learner rows were detected. Make sure this is the standard SF1 School Register file with 12-digit LRNs in the first column.",
        },
        400
      );
    }

    return json({
      ok: true,
      sheet_name: sheetName,
      metadata,
      rows: learners,
      learner_count: learners.length,
    });
  } catch (error) {
    return json(
      {
        error: "The SF1 Excel file could not be read.",
        detail: error instanceof Error ? error.message : String(error),
      },
      400
    );
  }
});
