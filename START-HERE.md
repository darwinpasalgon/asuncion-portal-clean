# Asuncion NHS Academic Portal

This repository contains the production Academic Portal of Asuncion National High School.

## Production architecture

- **Frontend / application:** Next.js on Vercel
- **Database, authentication, storage, and server functions:** Supabase
- **Production URL:** `https://asuncion-nhs.vercel.app`
- **Production branch:** `main`
- **Package manager:** pnpm
- **Node.js:** use the version declared in `package.json`

The portal uses school-managed accounts. Public registration is closed.

## Current functional areas

The production portal includes:

- Student, Teacher, Section Adviser, delegated Administrator, Registrar, Human Resources, and Super Administrator access
- School-managed learner and personnel accounts
- Bulk learner and teacher imports with temporary credentials
- Persistent sign-in with secure refresh-token cookies
- Learner information and enrollment management
- Grade 7-10 TVE majors and Grade 7 exploratory TVE rotations
- Senior High School Track and Strand/Program fields
- Section Adviser and Subject Teacher assignments
- Class and teacher schedules with conflict checking
- Attendance and SF2
- Grades and publication controls
- SF9 report cards
- SF10 permanent records
- Personnel profiles
- Announcements, Learning Resources, and Community Chat
- School readiness, reports, and grade-level administration

## Local development

Install the exact package-manager version declared in `package.json`, then run:

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Before opening a pull request or merging a production change:

```sh
pnpm typecheck
pnpm test
pnpm build
```

Do not place Supabase service-role keys, Vercel tokens, passwords, recovery codes, or other secrets in the repository.

## Production change workflow

1. Create a branch from the latest `main`.
2. Make the smallest necessary change.
3. Run type checking, automated tests, and a production build.
4. Verify the Vercel preview deployment.
5. For database changes, review the SQL carefully and verify Supabase security/performance advisors.
6. Merge only after the preview is healthy.
7. Verify the new production deployment and review runtime errors.

## Database migration caution

The live Supabase project has historical migration entries that do not perfectly match every migration filename currently stored in this repository. Do **not** rename, replay, delete, or mark historical migrations as applied merely to make the lists look identical.

Before any migration-history cleanup:

- compare the live schema with the repository,
- preserve production data,
- identify migrations that were applied under a different timestamp or directly,
- create a documented baseline/reconciliation plan, and
- test restoration on a non-production database first.

New schema changes should continue to be committed as migrations so the repository remains reproducible going forward.

## Access and data rules

- Students may access only their authorized academic information.
- Subject Teachers may see learners for their assigned classes but cannot publish adviser-only grades.
- Section Advisers manage their advisory learners within the permissions already enforced by the portal.
- Delegated administrators receive only the permissions assigned to them.
- Super Administrator access should remain limited.
- Public registration must remain disabled.
- Supabase Row Level Security and server-side authorization must be preserved.

## Senior High School data

Grade 11 and Grade 12 learner imports use the learner's Track and Strand/Program. Do not infer missing values from a learner's name or from an unrelated section.

ALS-SHS classification needs to remain distinguishable from ordinary SHS when its final section/program data model is implemented. Do not hard-code a section name as the only authorization or reporting rule.

## Useful files

- `RELEASE_CHECKLIST.md` - production release checklist
- `proxy.ts` - protected portal route authorization
- `next.config.ts` - application headers and redirects
- `supabase/migrations/` - committed database migrations
- `tests/` - regression tests
