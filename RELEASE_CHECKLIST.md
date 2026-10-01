# Asuncion NHS Academic Portal — Release Checklist

This checklist reflects the current production portal and PR #2 (`masterlist-activation`).

## Production status

- `main` is deployed successfully to Vercel.
- Public registration is closed in the Next.js application.
- `/register` redirects to sign-in and `/api/auth/register` rejects public registration.
- Student, Teacher, and Administrator authentication workflows are operational.
- Core modules are connected: enrollment, subjects, Teacher assignments, schedules,
  direct Term Grades, attendance, announcements/memorandums, learning resources,
  and Administrator reports.
- Row Level Security is enabled on all public application tables.
- Announcement and Learning Resource Storage buckets are private.
- Password-reset service tables are service-only and intentionally have no client RLS policies.

## Account security

- Portal authorization comes from `public.profiles`, not user-editable Auth metadata.
- The `authenticated` database role has the table-level UPDATE privilege needed for
  Administrator profile updates, while RLS policies remain the authorization boundary.
- Student and Teacher role tests cannot enumerate Administrator profiles.
- Supabase Auth user creation is additionally guarded by `private.handle_new_auth_user()`.
  New portal users must carry the server-only `app_metadata.anhs_provisioned=true` marker.
  Direct public signup attempts are rejected by the database trigger.
- Service-role credentials are used only inside secured Supabase Edge Functions and are
  never exposed to the browser or the Next.js client.
- New school-provisioned accounts are created with a temporary password and
  `must_change_password=true`. Users must create a private password on first sign-in.

## PR #2 — school-managed accounts

Implemented on the `masterlist-activation` branch:

- Administrator → Bulk account import.
- Student CSV template: LRN, Full Name, Grade Level, Section, optional Mobile.
- Teacher CSV template: Full Name, Email, optional Position and Mobile.
- CSV validation preview before account creation.
- Duplicate LRN/email checks.
- Maximum 200 accounts per import file.
- Server-generated temporary passwords displayed only in the immediate import result.
- Downloadable temporary-credentials CSV.
- Automatic active Student enrollment for the current school year.
- Administrator → Users & accounts.
- Edit Student name, LRN, contact, Grade and Section.
- Edit Teacher name, actual login email, contact and position/designation.
- Student Grade/Section edits synchronize the active school-year enrollment.
- Suspend and reactivate accounts.
- Protected permanent deletion refuses to erase accounts with official academic/activity records.
- Teacher email edits synchronize Supabase Auth and the portal profile.

## Database migration history

- `20260923085407` — `asuncion_portal_baseline`
- `20260923100105` — `masterlist_account_activation` (legacy schema retained for database-history consistency)
- `20260923100941` — `masterlist_activation_indexes`
- `20260923101636` — `restore_admin_profile_update_grant`
- `20261001030656` — `school_managed_account_provisioning`

The activation-roster tables from the September migration are no longer part of the
user-facing account workflow. They are retained to keep repository migration history
aligned with the live database.

## Expected Supabase advisor notices

- `password_recovery_challenges` and `password_reset_requests` report
  **RLS Enabled No Policy**. This is intentional because they are service-only.
- Unused-index notices are expected while the portal contains little production data.
- Multiple-permissive-policy notices are performance optimization opportunities, not
  current access-control failures.
- **Leaked Password Protection Disabled** remains a plan-limited security enhancement
  on the current Supabase Free plan.

## Before merging PR #2

1. Confirm the latest Vercel preview build is successful.
2. Test one temporary Student account end to end:
   import → sign in with LRN/temp password → required password change → Student portal.
3. Test one temporary Teacher account end to end:
   import → sign in with email/temp password → required password change → Teacher portal.
4. Test Administrator Users & accounts:
   edit a Student, edit a Teacher, suspend/reactivate, and verify protected deletion.
5. Re-run Supabase security/performance advisors and role-matrix checks.
6. Merge PR #2 into `main` only after explicit approval.
