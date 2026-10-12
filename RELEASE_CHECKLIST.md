# Asuncion NHS Academic Portal - Release Checklist

Use this checklist for every change that can reach `main`.

## 1. Scope

- The change has a clear purpose and does not include unrelated edits.
- Learner, grade, attendance, personnel, and credential data are not changed unless the task explicitly requires it.
- No password, token, service-role key, recovery code, or private credential is committed.

## 2. Authentication and authorization

- Public registration remains disabled.
- Students sign in with LRN and personnel sign in with their registered email address.
- Temporary-password users are still forced to change their password.
- Student, Teacher, Adviser, delegated Administrator, Registrar/HR, and Super Administrator restrictions still match the intended role.
- Protected routes enforce access server-side, not only by hiding navigation links.
- Supabase Row Level Security remains enabled on application tables.

## 3. Academic integrity

For changes affecting academic data:

- Confirm the active School Year.
- Confirm Grade and Section scoping.
- Confirm Section Adviser restrictions.
- Confirm Subject Teacher read/write restrictions.
- Confirm TVE Major filtering where applicable.
- Confirm SHS Track and Strand/Program handling for Grades 11-12.
- Confirm HGP/non-graded subjects do not accidentally appear in published grade forms when excluded.
- Confirm MAPEH calculations and school-form inclusion rules if touched.

## 4. School forms

If SF2, SF9, or SF10 is affected:

- Verify at least one real-looking fictional/test learner, not a production learner whose official record would be changed.
- Confirm learner ordering remains Male first, then Female, and alphabetic by surname within each group where that form requires it.
- Confirm A4 print layout and print-only styles.
- Confirm data is read from the correct School Year and Section.
- Confirm only authorized roles can print or edit.

## 5. Accounts and imports

If account or bulk-import code is affected:

- Reject duplicate LRNs/emails appropriately.
- Validate Grade and Section.
- Validate names, sex, birth date, and required learner information.
- Verify temporary credentials are shown/downloaded only as intended.
- Confirm imported users must change the temporary password.
- Confirm suspension/reactivation behavior.
- Confirm protected deletion does not erase official records unexpectedly.

## 6. Scheduling

If schedule or assignment code is affected:

- Run teacher, section, room, and TVE parallel-class conflict tests.
- Confirm adjacent periods do not falsely conflict.
- Confirm inactive assignments/schedules do not create false conflicts.
- Confirm schedule changes remain inside configured school hours.
- Confirm conflict messages identify the actual teacher/section involved.

## 7. Automated checks

Run:

```sh
pnpm typecheck
pnpm test
pnpm build
```

All must pass before merge.

## 8. Vercel preview

- Preview deployment reaches **READY**.
- Login page loads on desktop and mobile layouts.
- Saved sessions can be restored.
- No new runtime error cluster appears while testing the changed flow.
- Test the exact page or API affected by the change.

## 9. Supabase checks

For database/auth/storage changes:

- Review the migration before applying it.
- Run Supabase security advisors.
- Run Supabase performance advisors.
- Verify RLS/policies still enforce the expected roles.
- Treat `SECURITY DEFINER` functions as security-sensitive and verify explicit caller/ownership checks.
- Do not replay or rename old production migrations merely to align timestamps.

### Current known advisor items

As of the October 12, 2026 production audit:

- `password_recovery_challenges` and `password_reset_requests` are intentionally service-oriented tables with RLS enabled and no client policies.
- `account_provisioning_tokens` and `non_teaching_personnel` should remain part of the security review because the advisor reports RLS enabled without policies.
- Adviser RPCs using `SECURITY DEFINER` are explicitly permission-checked in their function bodies, but should continue to be reviewed when edited.
- Leaked-password protection is reported as disabled and should be enabled if the project's available Supabase plan/settings support it.
- Unused-index and multiple-permissive-policy notices should be reviewed as the dataset and traffic grow.

## 10. Merge and production verification

After a successful preview:

1. Merge the reviewed branch.
2. Confirm the production Vercel deployment reaches **READY**.
3. Open `https://asuncion-nhs.vercel.app`.
4. Confirm sign-in/session restoration.
5. Check Vercel runtime errors for the changed flow.
6. For database changes, verify the expected schema/data result with a read-only query.
