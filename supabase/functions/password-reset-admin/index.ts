import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.116.0";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });

function temporaryPassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const values = new Uint32Array(8);
  crypto.getRandomValues(values);
  const chars = Array.from(values, (value) => alphabet[value % alphabet.length]).join("");
  return `ANHS-${chars.slice(0, 4)}-${chars.slice(4)}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceRole) return json({ error: "Admin reset service unavailable." }, 500);

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) return json({ error: "Unauthorized." }, 401);

  const admin = createClient(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userResult, error: userError } = await admin.auth.getUser(token);
  const callerId = userResult?.user?.id;
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
  const action = String(body.action ?? "list");

  if (action === "list") {
    const { data: requests, error } = await admin
      .from("password_reset_requests")
      .select("id,user_id,status,requested_at")
      .eq("status", "pending")
      .order("requested_at", { ascending: true });

    if (error) return json({ error: "Could not load reset requests." }, 500);

    const ids = (requests ?? []).map((item) => item.user_id);
    let profiles: Array<Record<string, unknown>> = [];

    if (ids.length) {
      const { data } = await admin
        .from("profiles")
        .select("id,full_name,email,lrn,role,account_status")
        .in("id", ids);
      profiles = data ?? [];
    }

    const byId = new Map(profiles.map((profile) => [profile.id, profile]));
    const orphanRequestIds = (requests ?? [])
      .filter((request) => !byId.has(request.user_id))
      .map((request) => request.id);

    if (orphanRequestIds.length) {
      await admin
        .from("password_reset_requests")
        .update({
          status: "cancelled",
          resolved_at: new Date().toISOString(),
          resolved_by: callerId,
        })
        .in("id", orphanRequestIds);
    }

    const validRequests = (requests ?? []).filter((request) => byId.has(request.user_id));

    return json({
      ok: true,
      requests: validRequests.map((request) => ({
        ...request,
        profile: byId.get(request.user_id) ?? null,
      })),
    });
  }

  if (action !== "reset") return json({ error: "Invalid action." }, 400);

  const requestId = String(body.request_id ?? "");
  if (!requestId) return json({ error: "Reset request is required." }, 400);

  const { data: resetRequest } = await admin
    .from("password_reset_requests")
    .select("id,user_id,status")
    .eq("id", requestId)
    .maybeSingle();

  if (!resetRequest || resetRequest.status !== "pending") {
    return json({ error: "This reset request is no longer pending." }, 400);
  }

  const { data: target } = await admin
    .from("profiles")
    .select("id,account_status")
    .eq("id", resetRequest.user_id)
    .maybeSingle();

  if (!target || target.account_status !== "active") {
    return json({ error: "Only active accounts can be reset." }, 400);
  }

  const tempPassword = temporaryPassword();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const { error: passwordError } = await admin.auth.admin.updateUserById(resetRequest.user_id, {
    password: tempPassword,
  });

  if (passwordError) {
    return json({ error: "Could not create the temporary password." }, 500);
  }

  const { error: profileError } = await admin
    .from("profiles")
    .update({
      must_change_password: true,
      temp_password_expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", resetRequest.user_id);

  if (profileError) {
    return json({ error: "Password changed, but the forced-change flag could not be saved." }, 500);
  }

  const { error: resolveError } = await admin
    .from("password_reset_requests")
    .update({
      status: "completed",
      resolved_at: new Date().toISOString(),
      resolved_by: callerId,
    })
    .eq("id", requestId);

  if (resolveError) {
    return json({ error: "Password changed, but the reset request could not be closed." }, 500);
  }

  return json({
    ok: true,
    temporary_password: tempPassword,
    expires_at: expiresAt,
    message: "Temporary password created. Share it only after verifying the user's identity.",
  });
});
