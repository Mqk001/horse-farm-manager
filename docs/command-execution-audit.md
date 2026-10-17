# OS command-injection audit — October 17, 2026

## Result and scope

No request-controlled OS command execution was found. All 80 application source files were searched, along with the repository's tests, Prisma seed/migrations, configuration, package scripts and shell/batch entry points. No application module imports a process runner, uses a shell, or dynamically loads executable modules/code. API bodies, query/route parameters, cookies, form fields, farm/task/horse names and stored notes do not flow into command strings, executable names, argv, process environments or working directories.

No app functionality needed refactoring away from a subprocess: there was none. Fixed developer/build lifecycle commands remain in place. This is not a claim that every transitive dependency or host configuration is vulnerability-free.

## Every first-party command-launch entry point

| Site | Commands | Input and assessment |
| --- | --- | --- |
| package.json: scripts.dev | `prisma generate`; `prisma generate --schema prisma/schema.local.prisma`; `next dev` | Static developer command chain. No app/request interpolation. |
| package.json: scripts.build | `node scripts/check-process-execution.mjs`; `prisma generate`; `prisma generate --schema prisma/schema.local.prisma`; `next build` | Static build chain. New first step rejects prohibited application imports/code loading before building. |
| package.json: scripts.start | `next start` | Static server startup. The app does not construct or forward process arguments from HTTP data. |
| package.json: scripts.setup | `npx prisma generate`; `npx prisma migrate dev --name init`; `npx prisma db seed` | Static operator-only database setup chain. Audited but not executed; migrations/seeding were not needed for this audit. |
| package.json: prisma.seed | `tsx prisma/seed.ts` | Static Prisma seed command. Seed uses Prisma/bcrypt directly, not subprocess APIs. |
| package.json: scripts.audit:commands | `node scripts/check-process-execution.mjs` | New static audit entry point. The scanner itself reads/parses files and does not launch subprocesses. |
| start-farm.bat:2–4 | `cd /d "%~dp0"`; `npm run dev`; `pause` | Local Windows launcher, using a quoted script-directory path and a fixed npm command; no arguments or app input are interpolated. |

There are no other first-party shell scripts, process API call sites, OS command wrappers, Dockerfiles, Makefiles or workflow YAML launch sites in this checkout. Documentation examples are not executable app paths. npm's lifecycle shell and PATH are operator/build-environment trust boundaries, not inputs controlled by a Reinwell user.

## Dependency execution sites inspected

These are installed dependency implementations, not first-party code; no node_modules files were edited.

- `@prisma/client` 5.11.0 and generated `@prisma/local-client`, `runtime/library.js`: platform detection wraps `child_process.exec`. Callers use fixed `freebsd-version`, `openssl version -v`, the old-Node `uname -m` fallback, and an `ldconfig`/`sed`/`grep`/`sort` pipeline. The pipeline's interpolated filter is the constant `grep -v "libssl.so.0"`, not database or request input. Directory candidates affect filesystem reads, not shell text. Reinwell uses the default native-library Prisma client; query arguments are passed through Prisma, not shell commands. Prisma's alternate binary engine is dependency-managed and is not configured by a request.
- `google-auth-library` 11.3.1, `build/src/auth/pluggable-auth-handler.js:68`: optional external-account authentication uses `spawn(commandComponents[0], commandComponents.slice(1), {env: ...})` without `shell:true`. It requires trusted executable credential configuration and an explicit `GOOGLE_EXTERNAL_ACCOUNT_ALLOW_EXECUTABLES=1` opt-in. Reinwell constructs `OAuth2Client` for its authorization-code flow, not executable/pluggable credentials; no request payload is used as executable configuration.
- Next.js and Prisma CLI perform framework/build/runtime worker or engine startup. The repository supplies fixed lifecycle commands and configuration, with no user-supplied executable selection. This audit does not enumerate every internal worker call across these vendor packages.
- Lockfile install hooks exist for `@prisma/client`, `@prisma/engines`, `prisma`, `esbuild`, and `fsevents`. These are dependency-install lifecycle hooks, not web-request execution sites. Trusted dependency installation remains a separate supply-chain boundary.

## False-positive matches resolved

- `src/lib/database-url.ts` and password/token tests use RegExp `.exec`, not OS execution.
- `tests/migrations.mjs` and `tests/password-reset-migration.mjs` call PGlite `db.exec` to run SQL inside the embedded database. Their role/migration interpolation comes from fixed local arrays; no OS shell is involved. Optional `PGLITE_MODULE` selects a test-only module via operator environment and is not consumed by application code.
- HTTP integrations use `fetch`/SDK methods; no curl/wget subprocesses are used by app code. Database operations use Prisma.

## Prevention added

- `scripts/check-process-execution.mjs`: TypeScript-AST-based guard over all source JS/TS/TSX files. Rejects child_process imports/requires/re-exports/import-equals, common process-runner packages, nonliteral dynamic module loading, direct eval/Function and native-binding entry points. It does not execute scanned code.
- `package.json`: exposes `npm run audit:commands` and runs the guard at the beginning of `npm run build`.
- `tests/command-execution-policy.mjs`: rejection fixtures cover aliased imports, CommonJS/module.require, literal dynamic imports, re-exports, process.getBuiltinModule, shell runners and computed module names. SQL and RegExp exec fixtures remain accepted.

The guard is a review aid, not an OS sandbox or complete JavaScript taint analyzer. Indirect/metaprogrammed bypasses and new dependency internals still require code review. If a future feature truly needs a process, review that change explicitly: fixed executable, shell disabled, structured argv, allowlisted/validated arguments and no user-controlled environment/working directory. Do not weaken the rule by adding a generic command-string executor.

## Validation

- `node tests/command-execution-policy.mjs`: passed.
- `npm run audit:commands`: passed for 80 application files.
- `npm run build`: guard, Prisma generation, application compilation and type checks passed.
- `git diff --check`: passed.

No migrations, credentials, accounts or production data were changed. This change adds local/build enforcement and documentation; it does not require a production app deployment.
