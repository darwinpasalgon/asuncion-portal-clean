# Asuncion NHS Academic Portal — Release Checklist

This checklist applies to the `login-page` branch before it is merged into `main`.

## Completed

- Student, Teacher, and Administrator authentication verified.
- Database authorization comes from `public.profiles`, not user-editable Auth metadata.
- Administrator routes are protected in `proxy.ts` and again inside Administrator APIs.
- Only the Supabase publishable key is used by the Next.js application.
- Public database tables have Row Level Security enabled.
- Password-reset service tables have no `anon` or `authenticated` table grants.
- SECURITY DEFINER helper functions are kept in the private schema.
- Announcement and Learning Resource Storage buckets are private.
- Enrollment, subjects, Teacher assignments, class schedules, direct Term Grades,
  attendance, announcements/memorandums, learning resources, and reports are connected.
- Student/Teacher/Administrator RLS role-matrix tests passed.
- Foreign-key covering indexes recommended by the database advisor were added.
- Latest Vercel preview build on `login-page` is green.

## Required before production merge

### 1. Enable Supabase leaked-password protection

Supabase's security advisor currently reports **Leaked Password Protection Disabled**.

In Supabase Dashboard, open the Asuncion NHS Academic Portal project and enable
leaked-password protection under the Authentication password-security settings.

Re-run the Supabase Security Advisor afterward and confirm the warning is gone.

### 2. Capture the live database schema as migrations

The Supabase project currently reports an empty migration history. The database was
built iteratively through SQL during development, so it must be captured before release.

From a trusted local development machine with the Supabase CLI authenticated and this
repository checked out:

```bash
supabase --version
supabase db pull asuncion_portal_baseline --local --yes
supabase migration list --local
```

Review the generated migration carefully and confirm that it includes the portal's
tables, indexes, constraints, RLS policies, private helper functions, triggers, and
Storage-related database policies. Do not commit database credentials or secret keys.

## Final release sequence

1. Enable leaked-password protection.
2. Capture and review the Supabase baseline migration.
3. Run the Supabase Security Advisor again.
4. Confirm the latest `login-page` Vercel deployment is successful.
5. Perform one final Student, Teacher, and Administrator smoke test.
6. Merge PR #1 into `main`.
7. Confirm the production Vercel deployment and production domain.
