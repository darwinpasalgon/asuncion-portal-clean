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
    "id,ledger_sequence,personnel_id,non_teaching_personnel_id,credit_type,posting_date,transaction_kind,previous_balance,service_credits_earned,particulars,absence_days,service_credits_used,balance_after,remarks,source,source_file,source_sheet,source_row,created_by,created_at";

  async function loadProfileLedger(personnelId: string) {
    const { data, error } = await admin
      .from("service_credit_transactions")
      .select(ledgerSelect)
      .eq("personnel_id", personnelId)
      .order("ledger_sequence", { ascending: false })
      .limit(1000);
    if (error) throw new Error("Unable to load Service Credits transactions.");
    const items = data ?? [];
    const wellnessIds = items
      .filter((row) => row.credit_type === "wellness_leave")
      .map((row) => String(row.id));
    if (!wellnessIds.length) return items;
    const { data: corrections, error: correctionError } = await admin
      .from("service_credit_wellness_reconciliations")
      .select("transaction_id,corrected_used_days,original_used_days,source_balance_after,reason")
      .in("transaction_id", wellnessIds);
    if (correctionError) {
      throw new Error("Unable to reconcile Wellness Leave Excel entries. Balances were not displayed.");
    }
    const byId = new Map((corrections ?? []).map((entry) => [String(entry.transaction_id), entry]));
    return items.map((row) => {
      const correction = byId.get(String(row.id));
      return correction ? {
        ...row,
        service_credits_used: Number(correction.corrected_used_days),
        wellness_original_used: Number(correction.original_used_days),
        wellness_reconciled: true,
        wellness_reconciliation_reason: correction.reason,
        wellness_excel_balance: Number(correction.source_balance_after),
      } : row;
    });
  }

  async function loadNonTeachingLedger(personnelId: string) {
    const { data, error } = await admin
      .from("service_credit_transactions")
      .select(ledgerSelect)
      .eq("non_teaching_personnel_id", personnelId)
      .order("ledger_sequence", { ascending: false })
      .limit(1000);
    if (error) throw new Error("Unable to load Service Credits transactions.");
    return data ?? [];
  }

  async function loadSelfLedger(profileId: string) {
    const { data: linkedNonTeaching } = await admin
      .from("non_teaching_personnel")
      .select("id")
      .eq("portal_user_id", profileId)
      .eq("is_active", true)
      .maybeSingle();

    const [profileRows, nonTeachingRows] = await Promise.all([
      loadProfileLedger(profileId),
      linkedNonTeaching?.id
        ? loadNonTeachingLedger(String(linkedNonTeaching.id))
        : Promise.resolve([]),
    ]);

    return [...profileRows, ...nonTeachingRows]
      .sort((a, b) => Number(b.ledger_sequence ?? 0) - Number(a.ledger_sequence ?? 0))
      .slice(0, 1000);
  }

  function wellnessEligible(person: { role?: unknown; position?: unknown }) {
    return person.role === "teacher" || /^HEAD TEACHER\b/i.test(String(person.position ?? ""));
  }

  function summarize(rows: Array<Record<string, unknown>>, eligible = true) {
    const serviceRows = rows.filter((row) => row.credit_type === "service_credit");
    const wellnessRows = rows.filter((row) => row.credit_type === "wellness_leave");
    // Philippine calendar-year boundaries; the entitlement renews automatically on January 1.
    const wellnessYear = Number(
      new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", year: "numeric" }).format(new Date())
    );
    const wellnessUsed = wellnessRows
      .filter((row) => String(row.posting_date ?? "").startsWith(String(wellnessYear) + "-"))
      .reduce((sum, row) => sum + Number(row.service_credits_used ?? 0), 0);
    const wellnessBalance = eligible ? Math.max(0, Math.round((5 - wellnessUsed) * 10000) / 10000) : null;
    const latest = (items: Array<Record<string, unknown>>) =>
      items.length && String(items[0]?.particulars ?? "") !== "Balance Forwarded to Division Office"
        ? Number(items[0]?.balance_after ?? 0) : null;
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
      wellness_leave_balance: wellnessBalance,
      wellness_allowance: eligible ? 5 : 0,
      wellness_used: Math.round(wellnessUsed * 10000) / 10000,
      wellness_year: wellnessYear,
      total_service_credits_earned: Math.round(totalEarned * 10000) / 10000,
      total_service_credits_used: Math.round(totalUsed * 10000) / 10000,
      transaction_count: serviceRows.length,
      wellness_transaction_count: wellnessRows.length,
    };
  }

  if (action === "self") {
    if (caller.role === "student" || caller.requested_role === "student") {
      return json({ error: "Service Credits are available to personnel accounts only." }, 403);
    }
    try {
      const rows = await loadSelfLedger(caller.id);
      return json({
        ok: true,
        personnel: {
          id: caller.id,
          full_name: caller.full_name,
          email: caller.email,
          position: caller.position,
          role: caller.role,
        },
        summary: summarize(rows, wellnessEligible(caller)),
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
    const [{ data: portalPersonnel, error: portalError }, { data: nonTeaching, error: nonTeachingError }] =
      await Promise.all([
        admin
          .from("profiles")
          .select("id,full_name,email,position,role,requested_role,account_status")
          .eq("account_status", "active")
          .in("role", ["teacher", "staff_administrator"])
          .order("full_name")
          .limit(1000),
        admin
          .from("non_teaching_personnel")
          .select("id,full_name,email,position,portal_user_id,is_active")
          .eq("is_active", true)
          .is("portal_user_id", null)
          .order("full_name")
          .limit(1000),
      ]);

    if (portalError || nonTeachingError) {
      return json({ error: "Unable to load personnel accounts." }, 500);
    }

    const { data: transactions } = await admin
      .from("service_credit_transactions")
      .select("personnel_id,non_teaching_personnel_id,credit_type,balance_after,particulars,ledger_sequence")
      .order("ledger_sequence", { ascending: false })
      .limit(12000);

    const profileBalances = new Map<string, number | null>();
    const nonTeachingBalances = new Map<string, number | null>();
    for (const row of transactions ?? []) {
      if (row.credit_type !== "service_credit") continue;
      const forwarded = row.particulars === "Balance Forwarded to Division Office";
      if (row.personnel_id) {
        const id = String(row.personnel_id);
        if (!profileBalances.has(id)) profileBalances.set(id, forwarded ? null : Number(row.balance_after ?? 0));
      }
      if (row.non_teaching_personnel_id) {
        const id = String(row.non_teaching_personnel_id);
        if (!nonTeachingBalances.has(id)) {
          nonTeachingBalances.set(id, forwarded ? null : Number(row.balance_after ?? 0));
        }
      }
    }

    const combined = [
      ...(portalPersonnel ?? []).map((person) => ({
        ...person,
        owner_type: "profile",
        service_credit_balance: profileBalances.has(String(person.id))
          ? profileBalances.get(String(person.id))
          : null,
      })),
      ...(nonTeaching ?? []).map((person) => ({
        id: `nt:${person.id}`,
        full_name: person.full_name,
        email: person.email,
        position: person.position,
        role: "non_teaching_personnel",
        requested_role: null,
        account_status: "active",
        owner_type: "non_teaching",
        service_credit_balance: nonTeachingBalances.has(String(person.id))
          ? nonTeachingBalances.get(String(person.id))
          : null,
      })),
    ].sort((a, b) => String(a.full_name ?? "").localeCompare(String(b.full_name ?? "")));

    return json({ ok: true, personnel: combined });
  }

  const personnelToken = String(body.personnel_id ?? "");
  if (!personnelToken) return json({ error: "Select a personnel account." }, 400);

  const isNonTeaching = personnelToken.startsWith("nt:");
  const personnelId = isNonTeaching ? personnelToken.slice(3) : personnelToken;

  let target: Record<string, unknown> | null = null;

  if (isNonTeaching) {
    const { data } = await admin
      .from("non_teaching_personnel")
      .select("id,full_name,email,position,portal_user_id,is_active")
      .eq("id", personnelId)
      .eq("is_active", true)
      .maybeSingle();

    if (data) {
      target = {
        id: `nt:${data.id}`,
        full_name: data.full_name,
        email: data.email,
        position: data.position,
        role: "non_teaching_personnel",
        account_status: "active",
        owner_type: "non_teaching",
      };
    }
  } else {
    const { data } = await admin
      .from("profiles")
      .select("id,full_name,email,position,role,requested_role,account_status")
      .eq("id", personnelId)
      .maybeSingle();

    if (
      data &&
      data.account_status === "active" &&
      ["teacher", "staff_administrator"].includes(String(data.role))
    ) {
      target = { ...data, owner_type: "profile" };
    }
  }

  if (!target) {
    return json({ error: "Active personnel account not found." }, 404);
  }

  if (action === "get_personnel") {
    try {
      const rows = isNonTeaching
        ? await loadNonTeachingLedger(personnelId)
        : await loadProfileLedger(personnelId);
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
        summary: summarize(rows, wellnessEligible(target ?? {})),
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
    const creditType = String(body.credit_type ?? "service_credit");
    if (!["service_credit", "wellness_leave"].includes(creditType)) {
      return json({ error: "Unknown leave or credit type." }, 400);
    }
    if (creditType === "wellness_leave" && !wellnessEligible(target ?? {})) {
      return json({ error: "Wellness Leave posting is available to teaching personnel only." }, 403);
    }
    if (creditType === "wellness_leave" && kind !== "debit") {
      return json({ error: "Wellness Leave is a 5-day annual allowance and cannot be manually credited." }, 400);
    }
    if (!["credit", "debit"].includes(kind)) {
      return json({ error: "Choose Add Service Credits or Deduct Service Credits." }, 400);
    }

    const amount = number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0 || amount > (creditType === "wellness_leave" ? 5 : 999.99)) {
      return json({ error: "Enter a valid service credit amount from 0.01 to 999.99 days." }, 400);
    }

    const postingDate = String(body.posting_date ?? "");
    if (!validDate(postingDate)) {
      return json({ error: "Enter a valid posting date." }, 400);
    }

    const particulars = String(body.particulars ?? "").trim();
    const remarks = String(body.remarks ?? "").trim();
    if (!particulars) return json({ error: "Particulars are required." }, 400);
    if (creditType === "service_credit" && kind === "debit" && /wellness/i.test(particulars)) {
      return json({ error: "Wellness Leave must be deducted using the separate Wellness Leave tab, not Service Credits." }, 400);
    }
    if (particulars.length > 1000 || remarks.length > 1000) {
      return json({ error: "Particulars and Remarks must each be 1,000 characters or fewer." }, 400);
    }

    const row = {
      personnel_id: isNonTeaching ? null : personnelId,
      non_teaching_personnel_id: isNonTeaching ? personnelId : null,
      credit_type: creditType,
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
      if (/insufficient annual wellness leave balance/i.test(message)) {
        return json({ error: "The 5-day annual Wellness Leave allowance would be exceeded. Choose fewer days or check this year’s usage." }, 409);
      }
      if (/future date/i.test(message)) {
        return json({ error: "Wellness Leave cannot be deducted for a future date." }, 400);
      }
      if (/insufficient service credit balance/i.test(message)) {
        return json({ error: "Insufficient Service Credits balance for this deduction." }, 409);
      }
      return json({ error: "Unable to post the leave or Service Credits transaction." }, 500);
    }

    return json({ ok: true, transaction: saved });
  }

  return json({ error: "Unknown Service Credits action." }, 400);
});
