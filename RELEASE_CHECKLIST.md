# Asuncion NHS Academic Portal — Release Checklist

This checklist applies to the `login-page` branch before it is merged into `main`.

## Completed

- Student, Teacher, and Administrator authentication workflows were previously verified with real accounts.
- Final Student/Teacher/Administrator database/RLS smoke tests passed.
- Student/Teacher role tests cannot enumerate Administrator profiles.
- The authenticated role has no `UPDATE` table privilege on `public.profiles`, blocking direct role self-promotion.
- Database authorization comes from `public.profiles`, not user-editable Auth metadata.
- Administrator routes are protected in `proxy.ts` and again inside Administrator APIs.
- Only the Supabase publishable key is used by the Next.js application.
- All public application tables have Row Level Security enabled.
- Password-reset service tables intentionally have RLS with no client policies and no `anon`/`authenticated` table grants.
- SECURITY DEFINER helper functions are kept in the private schema with restricted execution grants.
- Announcement and Learning Resource Storage buckets are private.
- Enrollment, subjects, Teacher assignments, class schedules, direct Term Grades,
  attendance, announcements/memorandums, learning resources, and reports are connected.
- Foreign-key covering indexes recommended by the database advisor were added.
- The live database is captured in:
  - `supabase/migrations/20260923085407_asuncion_portal_baseline.sql`
  - Supabase migration history version `20260923085407`, name `asuncion_portal_baseline`
- School structure seed data is captured in `supabase/seed.sql`.
- The seed contains school years, grade levels, and sections only; it does not include users,
  grades, attendance, or other private student records.
- Password creation/change flows enforce a minimum of 8 characters on both client and server.
- Latest application changes are deployed through the Vercel preview branch before production merge.

## Plan-limited security enhancement

Supabase Security Advisor reports **Leaked Password Protection Disabled**.

The Asuncion National High School Supabase organization is currently on the **Free plan**.
Supabase documents leaked-password protection as a **Pro Plan and above** feature, so this
cannot be enabled without upgrading the Supabase organization. Do not treat this as an
unresolved application-code defect on the current Free plan.

If the school later upgrades to Pro or above, enable leaked-password protection in
Authentication password-security settings and re-run the Security Advisor.

## Expected advisor notices

- `password_recovery_challenges` and `password_reset_requests` report
  **RLS Enabled No Policy**. This is intentional: these are service-only tables and client
  roles have no table grants.
- Unused-index notices are expected while the portal has very little production data.
- Multiple-permissive-policy notices are performance optimization opportunities; the
  final role-matrix tests confirm the intended access boundaries.

## Remaining release step

1. Confirm the latest `login-page` Vercel deployment is successful.
2. Perform a quick visual check of the preview login/dashboard if desired.
3. Merge PR #1 into `main` only after explicit approval.
4. Confirm the production Vercel deployment and the final production domain.
