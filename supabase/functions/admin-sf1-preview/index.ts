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

type Sf1ColumnMap = {
  lrn: number;
  full_name: number;
  sex: number;
  birth_date: number;
  mother_tongue: number;
  ethnic_group: number;
  religion: number;
  address_house_street_purok: number;
  address_barangay: number;
  address_municipality_city: number;
  address_province: number;
  father_name: number;
  mother_maiden_name: number;
  guardian_name: number;
  guardian_relationship: number;
  mobile: number;
  learning_modality: number;
  remarks: number;
};

function isLrnCell(value: unknown) {
  return /^\d{12}$/.test(normalizeLrn(value));
}

function findFirstLearnerRow(rows: unknown[][]) {
  return rows.findIndex((row) => row.some((cell) => isLrnCell(cell)));
}

function detectSf1Columns(rows: unknown[][]): Sf1ColumnMap {
  const firstLearnerRow = findFirstLearnerRow(rows);
  const headerEnd = firstLearnerRow >= 0 ? firstLearnerRow : Math.min(rows.length, 20);
  const headerStart = Math.max(0, headerEnd - 10);
  const headerRows = rows.slice(headerStart, headerEnd);
  const maxColumns = headerRows.reduce((max, row) => Math.max(max, row.length), 0);

  const columnHeaders = Array.from({ length: maxColumns }, (_, column) =>
    compact(
      headerRows
        .map((row) => text(row[column]))
        .filter(Boolean)
        .join(" ")
    )
  );

  const findColumn = (
    matcher: (header: string) => boolean,
    fallback: number
  ) => {
    const index = columnHeaders.findIndex((header) => matcher(header));
    return index >= 0 ? index : fallback;
  };

  const lrn = findColumn((header) => header === "lrn" || header.startsWith("lrn"), 0);
  const fullName = findColumn(
    (header) =>
      header.startsWith("name") &&
      header.includes("lastname") &&
      header.includes("firstname") &&
      !header.includes("father") &&
      !header.includes("mother") &&
      !header.includes("guardian"),
    1
  );

  return {
    lrn,
    full_name: fullName,
    sex: findColumn((header) => header.startsWith("sex") || header.includes("sexmf"), 2),
    birth_date: findColumn((header) => header.includes("birthdate"), 3),
    mother_tongue: findColumn((header) => header.includes("mothertongue"), 5),
    ethnic_group: findColumn(
      (header) => header.includes("ethnicgroup") || header === "ip",
      6
    ),
    religion: findColumn((header) => header.includes("religion"), 7),
    address_house_street_purok: findColumn(
      (header) =>
        header.includes("house") &&
        header.includes("street") &&
        (header.includes("sitio") || header.includes("purok")),
      8
    ),
    address_barangay: findColumn((header) => header.includes("barangay"), 9),
    address_municipality_city: findColumn(
      (header) => header.includes("municipality") || header.includes("city"),
      10
    ),
    address_province: findColumn((header) => header.includes("province"), 11),
    father_name: findColumn((header) => header.includes("fathersname"), 12),
    mother_maiden_name: findColumn(
      (header) => header.includes("mothersmaidenname"),
      13
    ),
    guardian_name: findColumn(
      (header) =>
        header.includes("guardian") &&
        header.includes("name") &&
        !header.includes("contact") &&
        !header.includes("relationship"),
      14
    ),
    guardian_relationship: findColumn(
      (header) => header.includes("relationship"),
      15
    ),
    mobile: findColumn(
      (header) =>
        header.includes("contactnumber") &&
        (header.includes("parent") || header.includes("guardian")),
      16
    ),
    learning_modality: findColumn(
      (header) => header.includes("learningmodality"),
      17
    ),
    remarks: findColumn((header) => header.includes("remarks"), 18),
  };
}

function rowValue(row: unknown[], column: number) {
  return column >= 0 ? text(row[column]) : "";
}

function looksLikeLearnerName(value: unknown) {
  const candidate = text(value);
  return (
    candidate.includes(",") &&
    /[a-z]/i.test(candidate) &&
    !/^\d/.test(candidate)
  );
}

function findLearnerNameInRow(row: unknown[], lrnColumn: number, preferredColumn: number) {
  const preferred = rowValue(row, preferredColumn);
  if (looksLikeLearnerName(preferred)) return preferred;

  for (let column = Math.max(0, lrnColumn + 1); column < row.length; column += 1) {
    const candidate = rowValue(row, column);
    if (looksLikeLearnerName(candidate)) return candidate;
  }

  return preferred;
}

function findSexInRow(row: unknown[], preferredColumn: number) {
  const normalize = (value: unknown) => {
    const candidate = text(value).toUpperCase();
    if (candidate === "M" || candidate === "MALE") return "M";
    if (candidate === "F" || candidate === "FEMALE") return "F";
    return "";
  };

  const preferred = normalize(row[preferredColumn]);
  if (preferred) return preferred;

  for (const cell of row) {
    const candidate = normalize(cell);
    if (candidate) return candidate;
  }

  return text(row[preferredColumn]);
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

    const columns = detectSf1Columns(rows);

    const learners = rows
      .map((row, index) => {
        const lrn = normalizeLrn(row[columns.lrn]);
        if (!/^\d{12}$/.test(lrn)) return null;

        return {
          source_row: index + 1,
          lrn,
          full_name: findLearnerNameInRow(row, columns.lrn, columns.full_name),
          sex: findSexInRow(row, columns.sex),
          birth_date: rowValue(row, columns.birth_date),
          mother_tongue: rowValue(row, columns.mother_tongue),
          ethnic_group: rowValue(row, columns.ethnic_group),
          religion: rowValue(row, columns.religion),
          address_house_street_purok: rowValue(
            row,
            columns.address_house_street_purok
          ),
          address_barangay: rowValue(row, columns.address_barangay),
          address_municipality_city: rowValue(
            row,
            columns.address_municipality_city
          ),
          address_province: rowValue(row, columns.address_province),
          father_name: rowValue(row, columns.father_name),
          mother_maiden_name: rowValue(row, columns.mother_maiden_name),
          guardian_name: rowValue(row, columns.guardian_name),
          guardian_relationship: rowValue(row, columns.guardian_relationship),
          mobile: normalizeContact(row[columns.mobile]),
          learning_modality: rowValue(row, columns.learning_modality),
          remarks: rowValue(row, columns.remarks),
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
      detected_columns: columns,
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
