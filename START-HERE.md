# Asuncion NHS Academic Portal: Vercel migration package

This is a portable copy of your blue-and-green portal, with your official logo and Grade 7–12 options. Sections remain unspecified.

## What this package does

It runs the existing interactive demonstration on standard Next.js and can be deployed on Vercel. It no longer needs ChatGPT hosting or Cloudflare's Sites runtime. Your original private demo is unchanged.

## What it does not do yet

Real email/password login, permanent academic records, protected student accounts, account approval enforcement and private file storage are NOT implemented in this package. The role selector still previews demo roles. Changes reset on refresh. Do not use this package for real student records.

Moving a website changes its hosting address; it does not automatically add a database or secure accounts.

## Next steps with the assistant

1. Install/connect the Vercel and Supabase integrations offered in this conversation, using accounts you or the school control. If you need accounts, create them directly with the providers. Never paste passwords, access tokens, service-role keys or recovery codes into chat.
2. Tell the assistant when both connections are ready. The assistant can inspect the available projects and prepare a concrete setup. Do not select a project containing unrelated data.
3. Confirm the intended new or empty Supabase project and Vercel project. Costs or paid upgrades require your explicit approval.
4. Implement email verification, password reset, server/database-enforced roles and an approval workflow. Student self-registration must never grant teacher or administrator permissions. The first administrator must be assigned through an authorized administrator procedure.
5. Implement persistent grades, attendance, schedules, notices and private resources. Restrict student reads to their records, teacher writes to assigned classes, and resource access to authorized users. Sections can be added later.
6. Test with fictional accounts: each role's normal actions, access to another student's record, unassigned teacher access, disabled users and direct database/API requests. Test backup and recovery, and the approved school's data-retention process.
7. Publish the verified version under the Vercel-generated address. The exact address is assigned during deployment; no preferred name is guaranteed available. The address can later use a school-owned domain.

## Deploy only this demonstration manually

1. Extract the ZIP into a new folder. The folder containing package.json is the project root.
2. Put that folder in a private Git repository you control, then import it into Vercel. Alternatively use Vercel's CLI from the project root if you already use it.
3. Select Next.js as the framework. Use Node.js 22.x, pnpm from package.json, and the committed pnpm lockfile. The included vercel.json supplies installation and build commands. Do not set a static output directory.
4. Keep preview/deployment access restricted using the controls available on your account. Do not distribute the demonstration as a student login portal.
5. Deploy. Confirm that the logo loads, all six grade levels appear in the administrator registration form, and the role selector still clearly says it is a demonstration.

No account credentials or production records are included. No Supabase project has been configured and this package does not connect to a database.

## Local development

Use Node.js 22.13 or newer in the 22.x line. Install the pnpm version declared in package.json, then run:

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Production checks:

```sh
pnpm typecheck
pnpm build
pnpm start
```

The dependency lockfile is retained from the original portal for reproducibility. Some unused starter dependencies remain; no Sites configuration, hosted identifiers, source credentials, node_modules or build output is included.

## Provider instructions

- Vercel projects: https://vercel.com/docs/projects/overview
- Vercel domains: https://vercel.com/docs/domains/working-with-domains/add-a-domain
- Supabase authentication: https://supabase.com/docs/guides/auth
- Supabase database access rules: https://supabase.com/docs/guides/database/postgres/row-level-security
