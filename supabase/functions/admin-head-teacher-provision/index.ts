import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.116.0";

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

function temporaryPassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const values = new Uint32Array(10);
  crypto.getRandomValues(values);
  const chars = Array.from(values, (value) => alphabet[value % alphabet.length]).join("");
  return `ANHS-${chars.slice(0, 5)}-${chars.slice(5)}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceRole) return json({ error: "Head Teacher service unavailable." }, 500);

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) return json({ error: "Unauthorized." }, 401);

  const admin = createClient(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: authCaller, error: callerError } = await admin.auth.getUser(token);
  const callerId = authCaller?.user?.id ?? "";
  if (callerError || !callerId) return json({ error: "Unauthorized." }, 401);

  const { data: caller } = await admin
    .from("profiles")
    .select("id,role,account_status,admin_role")
    .eq("id", callerId)
    .maybeSingle();

  let allowed =
    caller?.role === "administrator" &&
    caller?.account_status === "active" &&
    caller?.admin_role === "super_administrator";

  if (!allowed && caller?.role === "staff_administrator" && caller?.account_status === "active") {
    const { data: permission } = await admin
      .from("administrator_permissions")
      .select("permission")
      .eq("administrator_id", callerId)
      .eq("permission", "teaching.manage")
      .limit(1)
      .maybeSingle();
    allowed = Boolean(permission);
  }

  if (!allowed) {
    return json({ error: "Subjects & Teachers permission required." }, 403);
  }

  const body = await req.json().catch(() => ({}));
  const action = String(body.action ?? "list");

  if (action === "list") {
    const { data: personnel, error } = await admin
      .from("non_teaching_personnel")
      .select("id,full_name,email,position,portal_user_id,is_active")
      .eq("is_active", true)
      .ilike("position", "HEAD TEACHER%")
      .order("full_name");

    if (error) return json({ error: "Unable to load Head Teachers." }, 500);

    return json({
      ok: true,
      head_teachers: personnel ?? [],
    });
  }

  if (action !== "provision") {
    return json({ error: "Invalid action." }, 400);
  }

  const personnelId = String(body.personnel_id ?? "").trim();
  if (!personnelId) return json({ error: "Head Teacher is required." }, 400);

  const { data: personnel, error: personnelError } = await admin
    .from("non_teaching_personnel")
    .select("id,full_name,email,position,portal_user_id,is_active")
    .eq("id", personnelId)
    .eq("is_active", true)
    .ilike("position", "HEAD TEACHER%")
    .maybeSingle();

  if (personnelError || !personnel) {
    return json({ error: "Active Head Teacher record not found." }, 404);
  }

  if (!personnel.email) {
    return json({ error: "This Head Teacher needs a DepEd email before being assigned to a subject." }, 409);
  }

  if (personnel.portal_user_id) {
    const { data: linkedProfile } = await admin
      .from("profiles")
      .select("id,full_name,email,role,position,account_status")
      .eq("id", personnel.portal_user_id)
      .maybeSingle();

    if (linkedProfile?.account_status === "active") {
      return json({
        ok: true,
        user_id: linkedProfile.id,
        created: false,
        profile: linkedProfile,
      });
    }
  }

  const { data: existingProfile } = await admin
    .from("profiles")
    .select("id,full_name,email,role,position,account_status")
    .ilike("email", String(personnel.email).trim().toLowerCase())
    .limit(1)
    .maybeSingle();

  if (existingProfile) {
    if (existingProfile.account_status !== "active") {
      return json({ error: "The existing portal account for this Head Teacher is not active." }, 409);
    }

    await admin
      .from("non_teaching_personnel")
      .update({
        portal_user_id: existingProfile.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", personnel.id);

    return json({
      ok: true,
      user_id: existingProfile.id,
      created: false,
      profile: existingProfile,
    });
  }

  const email = String(personnel.email).trim().toLowerCase();
  const password = temporaryPassword();
  const provisioningToken = crypto.randomUUID();

  const { error: tokenError } = await admin
    .from("account_provisioning_tokens")
    .insert({
      token: provisioningToken,
      email,
      requested_role: "teacher",
      expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      created_by: callerId,
    });

  if (tokenError) {
    return json({ error: "Unable to authorize Head Teacher account creation." }, 500);
  }

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      requested_role: "teacher",
      provisioning_token: provisioningToken,
      full_name: personnel.full_name,
      recovery_phone: "",
      position: personnel.position,
    },
    app_metadata: { anhs_provisioned: "true" },
  });

  if (createError || !created.user?.id) {
    await admin.from("account_provisioning_tokens").delete().eq("token", provisioningToken);
    return json(
      { error: createError?.message || "Unable to create the Head Teacher portal account." },
      500
    );
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("id,full_name,email,role,position,account_status")
    .eq("id", created.user.id)
    .maybeSingle();

  if (!profile || profile.account_status !== "active") {
    await admin.auth.admin.deleteUser(created.user.id);
    return json({ error: "Head Teacher account validation failed." }, 500);
  }

  await admin
    .from("non_teaching_personnel")
    .update({
      portal_user_id: created.user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", personnel.id);

  return json({
    ok: true,
    user_id: created.user.id,
    created: true,
    profile,
  });
});
