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

const allowedPermissions = new Set([
  "accounts.manage",
  "users.manage",
  "bulk_import.manage",
  "school_setup.manage",
  "teaching.manage",
  "schedules.manage",
  "attendance.manage",
  "reports.view",
  "announcements.manage",
  "resources.manage",
  "password_resets.manage",
  "sf10.manage",
  "hr.manage",
]);

const presetPermissions: Record<string, string[]> = {
  registrar: ["sf10.manage"],
  human_resources: ["hr.manage"],
  content_administrator: ["announcements.manage", "resources.manage"],
  school_administrator: [],
};

const allowedAdminRoles = new Set([
  "registrar",
  "human_resources",
  "content_administrator",
  "school_administrator",
]);

const nonTeachingPositions = new Set([
  "ADMINISTRATIVE OFFICER I",
  "ADMINISTRATIVE OFFICER II",
  "ADMINISTRATIVE OFFICER III",
  "ADMINISTRATIVE OFFICER IV",
  "ADMINISTRATIVE OFFICER V",
  "HEAD TEACHER I",
  "HEAD TEACHER II",
  "HEAD TEACHER III",
  "HEAD TEACHER IV",
  "PRINCIPAL I",
  "PRINCIPAL II",
  "PRINCIPAL III",
  "PRINCIPAL IV",
  "PROJECT DEVELOPMENT OFFICER I",
  "PROJECT DEVELOPMENT OFFICER II",
  "ADMINISTRATIVE ASSISTANT I",
  "ADMINISTRATIVE ASSISTANT II",
  "ADMINISTRATIVE ASSISTANT III",
  "REGISTRAR",
]);

function storedAdminRole(adminRole: string) {
  return adminRole === "human_resources" ? "school_administrator" : adminRole;
}

function temporaryPassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const values = new Uint32Array(10);
  crypto.getRandomValues(values);
  const chars = Array.from(values, (v) => alphabet[v % alphabet.length]).join("");
  return `ANHS-${chars.slice(0, 5)}-${chars.slice(5)}`;
}

function cleanPermissions(input: unknown, adminRole: string) {
  if (adminRole !== "school_administrator") {
    return presetPermissions[adminRole] ?? [];
  }
  return Array.from(
    new Set(
      (Array.isArray(input) ? input : [])
        .map((item) => String(item))
        .filter((item) => allowedPermissions.has(item))
    )
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceRole) {
    return json({ error: "Administrator management service unavailable." }, 500);
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) return json({ error: "Unauthorized." }, 401);

  const admin = createClient(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: callerResult, error: callerError } = await admin.auth.getUser(token);
  const callerId = callerResult?.user?.id ?? "";
  if (callerError || !callerId) return json({ error: "Unauthorized." }, 401);

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
    const { data: admins, error } = await admin
      .from("profiles")
      .select("id,full_name,email,position,admin_role,account_status,created_at")
      .in("role", ["administrator", "staff_administrator"])
      .order("created_at", { ascending: true });
    if (error) return json({ error: "Unable to load administrators." }, 500);

    const ids = (admins ?? []).map((item) => item.id);
    const { data: permissionRows } = ids.length
      ? await admin
          .from("administrator_permissions")
          .select("administrator_id,permission")
          .in("administrator_id", ids)
      : { data: [] };

    const permissions = new Map<string, string[]>();
    for (const row of permissionRows ?? []) {
      const current = permissions.get(row.administrator_id) ?? [];
      current.push(row.permission);
      permissions.set(row.administrator_id, current);
    }

    const { data: personnel, error: personnelError } = await admin
      .from("non_teaching_personnel")
      .select("id,full_name,email,position,portal_user_id,is_active")
      .eq("is_active", true)
      .order("full_name");

    if (personnelError) return json({ error: "Unable to load Non-Teaching Personnel." }, 500);

    return json({
      ok: true,
      administrators: (admins ?? []).map((item) => ({
        ...item,
        permissions: permissions.get(item.id) ?? [],
        is_current_user: item.id === callerId,
      })),
      non_teaching_personnel: personnel ?? [],
    });
  }

  if (action === "create") {
    const personnelId = String(body.personnel_id ?? "").trim();
    let fullName = String(body.full_name ?? "").trim().toUpperCase();
    let email = String(body.email ?? "").trim().toLowerCase();
    let position = (String(body.position ?? "").trim() || "Administrator").toUpperCase();
    const requestedAdminRole = String(body.admin_role ?? "registrar");
    const adminRole = storedAdminRole(requestedAdminRole);

    if (!allowedAdminRoles.has(requestedAdminRole)) {
      return json({ error: "Select a valid delegated administrator role." }, 400);
    }

    if (personnelId) {
      const { data: personnel } = await admin
        .from("non_teaching_personnel")
        .select("id,full_name,email,position,portal_user_id")
        .eq("id", personnelId)
        .maybeSingle();

      if (!personnel) return json({ error: "Non-Teaching Personnel record not found." }, 404);
      if (personnel.portal_user_id) {
        return json({ error: "This personnel record already has portal access." }, 409);
      }

      fullName = String(personnel.full_name ?? "").trim().toUpperCase();
      const suppliedEmail = String(body.email ?? "").trim().toLowerCase();
      const suppliedPosition = String(body.position ?? "").trim().toUpperCase();
      email = suppliedEmail || String(personnel.email ?? "").trim().toLowerCase();
      position = suppliedPosition || String(personnel.position ?? "").trim().toUpperCase();
    }

    if (!fullName) return json({ error: "Full name is required." }, 400);
    if (!position) return json({ error: "Select a non-teaching position." }, 400);
    if (personnelId) {
      const { data: currentPersonnel } = await admin
        .from("non_teaching_personnel")
        .select("position")
        .eq("id", personnelId)
        .maybeSingle();
      const currentPosition = String(currentPersonnel?.position ?? "").trim().toUpperCase();
      if (!nonTeachingPositions.has(position) && position !== currentPosition) {
        return json({ error: "Select a valid DepEd non-teaching position." }, 400);
      }
    } else if (!nonTeachingPositions.has(position)) {
      return json({ error: "Select a valid DepEd non-teaching position." }, 400);
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({ error: "Enter a valid email address." }, 400);
    }

    const permissions = cleanPermissions(body.permissions, requestedAdminRole);
    const password = temporaryPassword();
    const provisioningToken = crypto.randomUUID();

    const { error: provisioningError } = await admin
      .from("account_provisioning_tokens")
      .insert({
        token: provisioningToken,
        email,
        requested_role: "administrator",
        expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        created_by: callerId,
      });

    if (provisioningError) {
      return json({ error: "Unable to authorize secure administrator provisioning." }, 500);
    }

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        requested_role: "administrator",
        provisioning_token: provisioningToken,
        full_name: fullName,
        recovery_phone: "",
        position,
        admin_role: adminRole,
      },
      app_metadata: {
        anhs_provisioned: "true",
        anhs_admin_provisioned: "true",
      },
    });

    if (createError || !created.user?.id) {
      await admin
        .from("account_provisioning_tokens")
        .delete()
        .eq("token", provisioningToken);
      return json({ error: createError?.message || "Unable to create the administrator account." }, 400);
    }

    if (permissions.length) {
      const { error: permissionError } = await admin
        .from("administrator_permissions")
        .insert(
          permissions.map((permission) => ({
            administrator_id: created.user.id,
            permission,
            granted_by: callerId,
          }))
        );
      if (permissionError) {
        await admin.auth.admin.deleteUser(created.user.id);
        return json({ error: "Account creation was rolled back because permissions could not be saved." }, 500);
      }
    }

    if (personnelId) {
      const { error: linkError } = await admin
        .from("non_teaching_personnel")
        .update({ portal_user_id: created.user.id, email, position, updated_at: new Date().toISOString() })
        .eq("id", personnelId)
        .is("portal_user_id", null);

      if (linkError) {
        await admin.auth.admin.deleteUser(created.user.id);
        return json({ error: "Account creation was rolled back because the personnel record could not be linked." }, 500);
      }
    }

    return json({
      ok: true,
      administrator_id: created.user.id,
      temporary_password: password,
      permissions,
      assigned_role: requestedAdminRole,
    });
  }

  const administratorId = String(body.administrator_id ?? "");
  if (!administratorId || administratorId === callerId) {
    return json({ error: "Select a delegated Administrator account." }, 400);
  }

  const { data: target } = await admin
    .from("profiles")
    .select("id,role,admin_role,account_status,email,position")
    .eq("id", administratorId)
    .maybeSingle();

  if (!target || target.role !== "staff_administrator") {
    return json({ error: "Delegated Administrator account not found." }, 404);
  }

  if (action === "suspend" || action === "reactivate") {
    const nextStatus = action === "suspend" ? "suspended" : "active";
    const { error } = await admin
      .from("profiles")
      .update({ account_status: nextStatus, updated_at: new Date().toISOString() })
      .eq("id", administratorId);
    if (error) return json({ error: "Unable to update administrator status." }, 500);
    return json({ ok: true, account_status: nextStatus });
  }

  if (action === "delete") {
    const { error } = await admin.auth.admin.deleteUser(administratorId);
    if (error) return json({ error: "Unable to delete the delegated Administrator." }, 500);
    return json({ ok: true, deleted: true });
  }

  if (action === "update") {
    const fullName = String(body.full_name ?? "").trim().toUpperCase();
    const email = String(body.email ?? "").trim().toLowerCase();
    const position = String(body.position ?? "").trim().toUpperCase();
    const requestedAdminRole = String(body.admin_role ?? target.admin_role ?? "school_administrator");
    const adminRole = storedAdminRole(requestedAdminRole);

    if (!fullName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({ error: "Enter a valid name and email address." }, 400);
    }
    if (!position) return json({ error: "Select a non-teaching position." }, 400);
    if (!nonTeachingPositions.has(position) && position !== String(target.position ?? "").trim().toUpperCase()) {
      return json({ error: "Select a valid DepEd non-teaching position." }, 400);
    }
    if (!allowedAdminRoles.has(requestedAdminRole)) {
      return json({ error: "Select a valid delegated administrator role." }, 400);
    }

    if (email !== target.email) {
      const { error } = await admin.auth.admin.updateUserById(administratorId, {
        email,
        email_confirm: true,
      });
      if (error) return json({ error: "Unable to change the administrator login email." }, 400);
    }

    const { error: profileError } = await admin
      .from("profiles")
      .update({
        full_name: fullName,
        email,
        position,
        admin_role: adminRole,
        updated_at: new Date().toISOString(),
      })
      .eq("id", administratorId);
    if (profileError) return json({ error: "Unable to update the administrator profile." }, 500);

    const permissions = cleanPermissions(body.permissions, requestedAdminRole);
    await admin
      .from("administrator_permissions")
      .delete()
      .eq("administrator_id", administratorId);

    if (permissions.length) {
      const { error } = await admin
        .from("administrator_permissions")
        .insert(
          permissions.map((permission) => ({
            administrator_id: administratorId,
            permission,
            granted_by: callerId,
          }))
        );
      if (error) return json({ error: "Profile updated, but permissions could not be saved." }, 500);
    }

    return json({ ok: true, permissions });
  }

  return json({ error: "Invalid administrator-management request." }, 400);
});
