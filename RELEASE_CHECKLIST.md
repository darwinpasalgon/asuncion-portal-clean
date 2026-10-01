# Asuncion NHS Academic Portal — Release Checklist

This checklist applies to PR #2 before it is merged into `main`.

## Production already completed

- Production `main` is deployed successfully on Vercel.
- Public registration has been removed from the website.
- `/register` redirects to sign-in and the registration API rejects public account creation.
- Student, Teacher, and Administrator sign-in flows use verified school accounts.
- Students sign in with LRN; Teachers and staff sign in with registered email.
- Temporary-password users are forced to create a new private password before portal access.
- The live database has Row Level Security on the application tables.
- Student/Teacher role tests cannot enumerate Administrator profiles.
- Administrator account approval can update profiles while normal users remain blocked by RLS.
- Announcement and Learning Resource storage buckets are private.
- Grades, attendance, schedules, assignments, announcements, resources, and reports are connected.

## PR #2 — school-managed account administration

- Administrator → Users & accounts:
  - Search and filter Students and Teachers.
  - Edit Student name, LRN, Grade, Section, and contact information.
  - Student Grade/Section changes synchronize the active school-year enrollment.
  - Edit Teacher name, email/login, position/designation, and contact information.
  - Teacher email changes update the actual Supabase Auth login email.
  - Suspend and reactivate accounts.
  - Protected permanent deletion refuses to erase accounts with official academic/activity records.
- Administrator → Bulk account import:
  - Excel-compatible CSV templates for Students and Teachers.
  - Client-side preview and validation before any account is created.
  - Students: LRN, Full Name, Grade Level, Section, optional Mobile.
  - Teachers: Full Name, Email, optional Position and Mobile.
  - Accounts are created only by an active Administrator through a privileged Supabase function.
  - Imported users receive randomly generated temporary passwords.
  - Temporary passwords are returned for one-time download and are not stored in plaintext by the portal.
  - Every imported user must change the temporary password on first sign-in.
  - Large files are imported in batches of 50 accounts.
- Database account-creation trigger accepts only school-provisioned Auth users with
  `app_metadata.anhs_provisioned=true`. Public/direct signups are rejected by the database trigger.
- Applied Supabase migration history is represented in the repository.
- Supabase Edge Functions are excluded from the Next.js TypeScript build because they use the Deno runtime.

## Expected Supabase advisor notices

- `password_recovery_challenges` and `password_reset_requests` report
  **RLS Enabled No Policy**. This is intentional because they are service-only tables.
- **Leaked Password Protection Disabled** remains a plan-limited warning on the current Supabase Free plan.
- Unused-index notices are expected while production data volume is still small.
- Multiple-permissive-policy notices are performance optimization opportunities, not current access failures.

## Before merging PR #2

1. Confirm the latest Vercel preview build is successful.
2. Test one Student import:
   - Import one unused LRN.
   - Sign in using the issued temporary password.
   - Confirm forced password change.
   - Confirm Grade and Section enrollment.
3. Test one Teacher import:
   - Import one unused email.
   - Sign in using the issued temporary password.
   - Confirm forced password change.
4. Test Users & accounts:
   - Edit Student Grade/Section.
   - Edit Teacher position/email.
   - Suspend and reactivate a test account.
   - Confirm protected deletion blocks accounts with official records.
5. Merge PR #2 only after explicit approval.
6. Confirm the production Vercel deployment after merge.
