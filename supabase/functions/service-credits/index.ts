import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.116.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

const validDate = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(value)) &&
  new Date(value).toISOString().slice(0, 10) === value;

const number = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : NaN;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer /, "");
  if (!token) return json({ error: "Unauthorized." }, 401);

  const url = Deno.env.get("SUPABASE_URL");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceRole) return json({ error: "Service Credits service unavailable." }, 500);

  const admin = createClient(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: auth, error: authError } = await admin.auth.getUser(token);
  if (authError || !auth.user) return json({ error: "Unauthorized." }, 401);

  const { data: caller } = await admin
    .from("profiles")
    .select("id,full_name,email,role,requested_role,admin_role,position,account_status,must_change_password")
    .eq("id", auth.user.id)
    .maybeSingle();

  if (!caller || caller.account_status !== "active") {
    return json({ error: "An active account is required." }, 403);
  }
  if (caller.must_change_password) {
    return json({ error: "Change your temporary password before opening Service Credits." }, 403);
  }

  const superAdmin =
    caller.role === "administrator" && caller.admin_role === "super_administrator";

  let canManage = superAdmin;
  if (caller.role === "staff_administrator") {
    const { data: permission } = await admin
      .from("administrator_permissions")
      .select("permission")
      .eq("administrator_id", caller.id)
      .eq("permission", "hr.manage")
      .maybeSingle();
    canManage = Boolean(permission);
  }

  const body = await req.json().catch(() => null);
  if (!body) return json({ error: "Invalid request." }, 400);
  const action = String(body.action ?? "self");

  const ledgerSelect =
    "id,ledger_sequence,personnel_id,credit_type,posting_date,transaction_kind,previous_balance,service_credits_earned,particulars,absence_days,service_credits_used,balance_after,remarks,source,source_file,source_sheet,source_row,created_by,created_at";

  async function loadLedger(personnelId: string) {
    const { data, error } = await admin
      .from("service_credit_transactions")
      .select(ledgerSelect)
      .eq("personnel_id", personnelId)
      .order("ledger_sequence", { ascending: false })
      .limit(1000);
    if (error) throw new Error("Unable to load Service Credits transactions.");
    return data ?? [];
  }

  function summarize(rows: Array<Record<string, unknown>>) {
    const serviceRows = rows.filter((row) => row.credit_type === "service_credit");
    const wellnessRows = rows.filter((row) => row.credit_type === "wellness_leave");
    const latest = (items: Array<Record<string, unknown>>) =>
      items.length ? Number(items[0]?.balance_after ?? 0) : null;
    const totalEarned = serviceRows.reduce(
      (sum, row) => sum + Number(row.service_credits_earned ?? 0),
      0
    );
    const totalUsed = serviceRows.reduce(
      (sum, row) => sum + Number(row.service_credits_used ?? 0),
      0
    );
    return {
      service_credit_balance: latest(serviceRows),
      wellness_leave_balance: latest(wellnessRows),
      total_service_credits_earned: Math.round(totalEarned * 100) / 100,
      total_service_credits_used: Math.round(totalUsed * 100) / 100,
      transaction_count: serviceRows.length,
      wellness_transaction_count: wellnessRows.length,
    };
  }

  if (action === "self") {
    if (caller.role === "student" || caller.requested_role === "student") {
      return json({ error: "Service Credits are available to personnel accounts only." }, 403);
    }
    try {
      const rows = await loadLedger(caller.id);
      return json({
        ok: true,
        personnel: {
          id: caller.id,
          full_name: caller.full_name,
          email: caller.email,
          position: caller.position,
          role: caller.role,
        },
        summary: summarize(rows),
        transactions: rows.slice(0, 100),
      });
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : "Unable to load Service Credits." }, 500);
    }
  }

  if (!canManage) {
    return json({ error: "Human Resources access required." }, 403);
  }

  if (action === "list_personnel") {
    const { data: personnel, error } = await admin
      .from("profiles")
      .select("id,full_name,email,position,role,requested_role,account_status")
      .eq("account_status", "active")
      .in("role", ["teacher", "staff_administrator"])
      .order("full_name")
      .limit(1000);

    if (error) return json({ error: "Unable to load personnel accounts." }, 500);

    const { data: transactions } = await admin
      .from("service_credit_transactions")
      .select("personnel_id,credit_type,balance_after,ledger_sequence")
      .order("ledger_sequence", { ascending: false })
      .limit(5000);

    const balances = new Map<string, number>();
    for (const row of transactions ?? []) {
      if (row.credit_type !== "service_credit") continue;
      const id = String(row.personnel_id ?? "");
      if (!balances.has(id)) balances.set(id, Number(row.balance_after ?? 0));
    }

    return json({
      ok: true,
      personnel: (personnel ?? []).map((person) => ({
        ...person,
        service_credit_balance: balances.has(String(person.id))
          ? balances.get(String(person.id))
          : null,
      })),
    });
  }

  const personnelId = String(body.personnel_id ?? "");
  if (!personnelId) return json({ error: "Select a personnel account." }, 400);

  const { data: target } = await admin
    .from("profiles")
    .select("id,full_name,email,position,role,requested_role,account_status")
    .eq("id", personnelId)
    .maybeSingle();

  if (
    !target ||
    target.account_status !== "active" ||
    !["teacher", "staff_administrator"].includes(String(target.role))
  ) {
    return json({ error: "Active personnel account not found." }, 404);
  }

  if (action === "get_personnel") {
    try {
      const rows = await loadLedger(personnelId);
      const creatorIds = Array.from(
        new Set(rows.map((row) => String(row.created_by ?? "")).filter(Boolean))
      );
      const creatorMap = new Map<string, string>();
      if (creatorIds.length) {
        const { data: creators } = await admin
          .from("profiles")
          .select("id,full_name")
          .in("id", creatorIds);
        for (const creator of creators ?? []) {
          creatorMap.set(String(creator.id), String(creator.full_name ?? "HR"));
        }
      }

      return json({
        ok: true,
        personnel: target,
        summary: summarize(rows),
        transactions: rows.map((row) => ({
          ...row,
          created_by_name: row.created_by
            ? creatorMap.get(String(row.created_by)) ?? "HR"
            : row.source === "excel_import"
              ? "Legacy Excel Import"
              : "System",
        })),
      });
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : "Unable to load Service Credits." }, 500);
    }
  }

  if (action === "post_transaction") {
    const kind = String(body.transaction_kind ?? "");
    if (!["credit", "debit"].includes(kind)) {
      return json({ error: "Choose Add Service Credits or Deduct Service Credits." }, 400);
    }

    const amount = number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0 || amount > 999.99) {
      return json({ error: "Enter a valid service credit amount from 0.01 to 999.99 days." }, 400);
    }

    const postingDate = String(body.posting_date ?? "");
    if (!validDate(postingDate)) {
      return json({ error: "Enter a valid posting date." }, 400);
    }

    const particulars = String(body.particulars ?? "").trim();
    const remarks = String(body.remarks ?? "").trim();
    if (!particulars) return json({ error: "Particulars are required." }, 400);
    if (particulars.length > 1000 || remarks.length > 1000) {
      return json({ error: "Particulars and Remarks must each be 1,000 characters or fewer." }, 400);
    }

    const row = {
      personnel_id: personnelId,
      credit_type: "service_credit",
      posting_date: postingDate,
      transaction_kind: kind,
      previous_balance: 0,
      service_credits_earned: kind === "credit" ? amount : 0,
      particulars,
      absence_days: 0,
      service_credits_used: kind === "debit" ? amount : 0,
      balance_after: 0,
      remarks: remarks || null,
      source: "manual",
      created_by: caller.id,
    };

    const { data: saved, error } = await admin
      .from("service_credit_transactions")
      .insert(row)
      .select(ledgerSelect)
      .single();

    if (error || !saved) {
      const message = String(error?.message ?? "");
      if (/insufficient service credit balance/i.test(message)) {
        return json({ error: "Insufficient Service Credits balance for this deduction." }, 409);
      }
      return json({ error: "Unable to post the Service Credits transaction." }, 500);
    }

    return json({ ok: true, transaction: saved });
  }

  return json({ error: "Unknown Service Credits action." }, 400);
});
