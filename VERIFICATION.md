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
