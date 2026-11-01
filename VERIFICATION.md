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

## Optional Fitzpatrick integration — 16 October 2026

- 54 tests passed; typecheck and production build passed; production dependency audit found zero vulnerabilities.
- New parser fixtures cover I–VI, nullable fields, missing/invalid classifications, pending/failure states, and multi-face detection.
- Route tests cover ownership, explicit consent, previous-task reuse without provider calls, and expired-photo rejection.
- Migration applied through authenticated Supabase tools. Rolled-back live database checks verified owner_visible=1, other_user_visible=0; anon SELECT, authenticated INSERT, and authenticated provider task ID reads were denied.
- Demo panel rendered and visually verified without inventing a classification.
- No new real photo was transmitted and no paid Fitzpatrick task was submitted during implementation. Provider results/face-preprocess shape are based on official OpenAPI documentation and still require one live consented test.

## Rule-based product discovery — 16 October 2026

- 67 tests across 14 files pass; strict TypeScript, optimized production build and production dependency audit pass (zero reported vulnerabilities).
- The catalog contains 100 active, source-checked product records from five official Indian stores, 33 ingredient entries, and mappings for all 15 YouCam indicators. Captured source-product JSON is retained and unit tests verify exact names, chosen variant prices/availability and SHA-256 provenance.
- Full published INCI is captured for 54 records; 46 expose only manufacturer-named key ingredients. Forty-three have unknown explicit skin suitability. Unknown values remain visible and do not satisfy safety/suitability filters. Store observations are not guarantees of delivered formulations, live stock, offers, efficacy or allergy safety.
- Verified YouCam higher-favorable score direction is used only to suggest three relative whole-face priorities for the supported provider. Unknown-provider/missing/invalid scores are not interpreted. No diagnostic severity thresholds or generated treatment claims are used. Structural-only eye concerns return guidance rather than corrective creams.
- Applied migration `20261016153500_add_verified_product_catalog.sql` to the existing agriguard project, imported the catalog and source records, and added indexed optional product links to existing experiments. No legacy scans or photos were modified.
- Live two-user workflow verification passed: public factual catalog reads, denied catalog writes, saved private preferences, cross-user preference isolation, invalid-budget rejection, canonical product name/ID retention on experiment creation, usage logging, baseline/follow-up data, numerical comparison API (+3 fixture points), hidden inactive products and denied foreign experiment reads. All exact temporary users and cascading QA fixtures were removed. No paid YouCam calls, real-photo uploads or LLM calls were made for these checks.
- Browser verification passed: `/products`, manual focus, category filtering, ingredient/source disclosures, tracking prefill, demo experiment creation and daily usage journal. Phone viewport 390×844 showed readable cards and no horizontal overflow. Desktop and phone screenshots are saved alongside the source archive.
- An integration test initially caught stale development module state dropping the new product field. Restarting the development server loaded the new schema; the live canonical-identity and complete workflow checks then passed.
- Supabase advisors found no errors or missing foreign-key indexes. Public catalog GraphQL visibility is intentional; private preference rows remain owner-filtered. New-index “unused” informational notices are expected immediately after creation. Existing legacy public scan visibility and disabled leaked-password protection remain separate project notices. Guidance: https://supabase.com/docs/guides/database/database-linter?lint=0026_pg_graphql_anon_table_exposed and https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection.
- Catalog verification expires after 30 days; rechecking real source facts is required before refreshing dates. This change is verified locally and in the existing Supabase backend; it is not a claim of a new public website deployment or clinical validation.

### Empty-match recovery

The zero-match state now explains each selected concern, distinguishes structural guidance from ingredient/suitability restrictions, and counts products newly eligible with adult confirmation without changing that preference. “Browse basic care” clears only concern/search/category/brand selections; budget, ingredient exclusions, skin type and active-ingredient preferences remain applied. Browser reproduction of pore/dark-circle/tear-trough priorities returned zero targeted matches and successfully recovered 25 eligible basic-care records in the demo profile. Four additional regression tests cover explanations, structural concerns, restricted budgets and accurate age-blocked counts; 71 tests now pass.

### Automatic basic-care alternatives

Reproduced the reported dry-skin selection with tear troughs, dark circles and pores. The page now retains the selected priorities and directly displays 27 eligible basic-care records with an explicit separate label and 0 targeted matches. No age confirmation, retinoid, ingredient, budget or skin-type filter is relaxed. Scan selector scores use one decimal. Two additional regression tests verify automatic basic-care separation and preservation of budget/discovery filters; 73 tests, strict TypeScript and production build pass.

## Product list refinement — 17 October 2026

Added a nine-option category/brand-balanced starter shortlist, all-eligible view, full-ingredient-only discovery filter, ingredient-list badges and relevant-first ingredient tags. Reduced repeated card text and folded selected concern evidence into a disclosure. No catalog facts, safety eligibility rules or private preferences were changed. Four new tests verify category/brand variety, deterministic selection without mutation, preference for ordinary formats, and attributable ingredient tags. All 77 tests, TypeScript and production build pass. Browser checks verified shortlist/all switching and that all 12 initially visible full-list-filtered cards carried full ingredient lists.

## Next.js security patch — 1 November 2026

Ran the official security upgrade workflow, which selected Next.js 16.4.3 for the affected 16.4.0 installation. Pinned the exact patched release, updated the lockfile and matching Next.js packages, and retained security upgrade reminders through experimental.agentUpgrade. No major-version migration or unrelated dependency upgrade was applied. Verification under Node 24.22.1: strict TypeScript, all 77 tests and the production build passed; npm audit reported zero known vulnerabilities. Initial disk-space failures were resolved by removing only incomplete/generated project dependencies and build caches before rerunning successfully.

## Live camera capture — 1 November 2026

Added camera preview, front/back preference switching, bounded JPEG still capture, review/retake, and upload fallback on the existing scan screen. Each new valid photo resets per-photo consent and idempotency. The live stream is browser-local, audio is disabled, and no provider request occurs until analysis is explicitly submitted. Stream lifecycle handles switching/unmounting and late permission grants safely. Seven regression tests cover delayed grants, stale concurrent requests, stream shutdown, error guidance, unavailable frames, JPEG dimensions/no upscaling and failed encoding. All 84 tests, strict TypeScript and Next.js 16.4.3 production build pass under Node 24. Browser checks verified camera/upload controls, the permission-wait state with capture disabled, and cancellation back to upload. Actual hardware capture was not granted during automated browser verification; no real photograph was captured or uploaded and no paid provider task was started.


## Free-tier skincare assistant · 2026-11-01

- Added server-only Groq adapter, default `qwen/qwen3.8-27b` preview model, without an OpenAI paid endpoint fallback. Availability/free quotas checked against official Groq docs. Account billing/limits remain the operator's responsibility.
- Expanded prompt from scan-only explanations to skincare education grounded in reviewed reference notes and existing concern limitations; product matching remains deterministic.
- Existing server sharing switch and per-user consent both remain required. Context is bounded and explicit: at most three scans, five experiments and five capped usage notes each. Identifiers, photos, storage paths and capture notes are excluded. A test caught identifiers inherited through comparison objects; comparisons now use an explicit field allowlist.
- Added free-quota/configuration error handling, output cap and hidden reasoning. No retries or paid fallback. No fake model output on provider failure.
- Browser verified synthetic demo dry-skin question -> relevant, clearly labeled reference guidance; source library and product/settings links visible. Saved preview at `../velqora-ai-insights.png`.
- 88 tests in 17 files pass; strict TypeScript and Next.js production build pass on Node 24.
- Live Groq inference was not tested: `GROQ_API_KEY` is not yet configured. The external-sharing switch is still false and no personal sharing preferences were changed. Prompt safeguards do not establish clinical validation.
