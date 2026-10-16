# Verification — 14 October 2026

## Passed

- Strict TypeScript (`npm run typecheck`).
- 34 tests across nine files (`npm test`).
- Optimized Next.js production build (`npm run build`).
- Dependency audit: zero reported vulnerabilities (`npm audit`).
- Production HTTP checks: landing, login, signup, privacy, and demo return 200; unauthenticated real workspace routes redirect to login; unconfigured live APIs return explicit setup errors; maintenance rejects unauthorized requests.
- Browser: labeled synthetic dashboard; all 15 result indicators and regional classification; experiment creation; usage logging; deterministic insight response; history metric selection; selected-scan comparison; synthetic scan creation and results navigation.
- Browser: desktop (1440 px) and phone (390 px) layouts. Mobile dashboard fits without horizontal overflow; bottom navigation moves between pages. Desktop and mobile screenshots are included alongside the source archive.

## Requires live configuration

Supabase and provider credentials were not supplied. No live user registration/email confirmation, SQL migration/RLS execution, storage upload/deletion, paid YouCam request, or external LLM call was performed. Mocked ownership tests verify server query filters, not a deployed database's policies. `supabase/tests/security.sql` provides a rollback-based database check for a configured development project.

The code uses real provider endpoints and has no synthetic fallback for real requests. The synthetic demo proves application interactions only. Live analysis is gated until provider numerical-retention permissions have been reviewed and `HISTORY_RETENTION_ENABLED` is enabled.

Vercel deployment was not performed. Follow README deployment instructions and the live acceptance checklist before presenting the app as production ready. Test secrets, auth redirects, quotas, interrupted task recovery, storage lifecycle, and cross-user isolation in that environment.

## Environment notes

The host ran Node 23.11.0; builds and tests succeeded. Use the supported Node 22.12+ LTS or Node 24 LTS runtime for reproducible deployment. Development cache writes briefly ran out of disk space; only this project's generated Next.js cache was cleared, and the production build was rerun successfully. Source and user files were preserved.

The local preview server was used for verification and stopped during teardown. Start it again with `npm run dev`, then open the URL printed by Next.js.


## Supabase integration — 16 October 2026

- Connected the existing agriguard project, preserving 21 legacy scan records and its bucket.
- Applied both migrations atomically; recorded their versions in protected migration history.
- Verified nine new RLS-protected tables and the private `skin-photos` bucket.
- Executed the rollback-based two-user database security test successfully.
- Passed 15 live integration assertions covering signup-token verification, password auth,
  SSR cookies, per-user visibility, anonymous denial, privileged RPC denial, account API,
  consent/profile persistence, history, deterministic insights, private storage, expiring URLs,
  cross-user consent isolation, and the retention gate. Temporary fixtures were removed.
- Added regression coverage for same-origin requests when Next canonicalizes loopback hosts.
  The suite now has 36 passing tests across nine files; TypeScript passes.
- Added both local auth callback origins and verified email confirmation remains enabled.
- Refreshed the Supabase security advisor: zero errors. Legacy public scan resources and
  intentional RLS-protected signed-in GraphQL schema visibility remain warnings.
- No YouCam/LLM credentials were supplied. Paid provider analysis, actual email delivery,
  scheduled production photo cleanup, and HTTPS deployment remain unverified.

## YouCam live diagnosis — 16 October 2026

- Authentication and balance GET requests succeeded.
- Live photo task initially failed because the provider treated the signed URL query as a filename.
- Direct YouCam File API upload and file-ID submission succeeded in a single recovery attempt.
- The recovered task returned `error_large_face_angle` at the first status check; its saved status is failed with straight-on photo guidance. No scores were fabricated or saved.
- Parser regression tests now cover null results in running/error responses and safe failure messages.
- A successful live analysis still needs a suitable front-facing photo.

## Successful live result recovery — 16 October 2026

A real YouCam v2.1 task completed successfully, returning `error: null` and `url: null` on output entries. The parser now accepts these nullable optional fields without relaxing numeric score validation. The existing task was polled and its real output saved through `complete_scan`, then read back to verify completed status, 15 metric rows, and 3 regional classifications. No new task or photo submission was made for this recovery. Regression data uses synthetic scores and example URLs only.
