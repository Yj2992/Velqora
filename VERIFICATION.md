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


## Discoverable AI consent settings · 2026-11-01

Moved the existing AI checkbox out of the profile form into a dedicated top-of-page AI Insights sharing card, with saved state, explicit save button and direct Insights anchor links. Profile saves preserve the saved AI preference. Demo explicitly disables external sharing and explains that sign-in is required. Browser verified card visibility and demo-disabled controls; no real user's consent was changed. All 88 tests and strict TypeScript pass.


## AI Insights workspace redesign · 2026-11-01

- Replaced the single expanding chat card with a contained scrollable conversation, multiline composer, character count, copy actions, pending/error states, and searchable saved-answer history. Recent view shows the latest six answers; all records remain accessible in History.
- Added four question categories with editable starters, latest scan details, active experiment links, connected product/progress actions and source library. Sharing/demo labels and selected comparison scan IDs are preserved. No server or database behavior changed; saved history is a record of individual questions, not a claim of model conversation memory.
- Browser verified history filtering/opening, question category changes, starter -> composer -> send -> persisted synthetic answer, and 390px mobile layout/composer without horizontal overflow. Desktop screenshot saved at `../velqora-insights-studio.png`.
- All 88 existing tests, strict TypeScript and production build passed. No personal data or scan photos were sent to an external model during UI verification.


## Groq-assisted Find Products · 2026-11-01

- Added a dedicated natural-language catalog search and review/apply flow, using strict JSON schema and Zod validation with the existing Groq Qwen configuration. The model supplies filter intent only; products, facts, ranking and explanations remain catalog/rule based. No web-search or live-price claim.
- Added category navigation, up-to-three-product factual comparison and a persistent comparison shortcut. Existing sources, filters, scan concern interpretation and canonical Experiment Lab tracking links are preserved.
- Added authenticated POST `/api/products/search`, owner-filtered saved consent, quota 10/hour, no-store responses, and timeout/quota/configuration handling. Only the typed request and public vocabulary are transmitted. Server configuration and per-user consent are required; no model calls in demo. No schema/RLS changes. Reviewed Supabase skill security checklist: server-only credentials, authenticated owner ID, existing same-origin guard and no metadata-based authorization.
- Parser output cannot contain products/URLs or change age confirmation/retinoid avoidance. Existing exclusions, stricter budget and manufacturer-claim filters remain. Unresolved requirements block apply; no inferred SPF/formulation/medical suitability. Pregnancy/breastfeeding requirements are flagged as unresolved in code as well as the prompt.
- 105 offline tests passed; 1 opt-in live smoke test skipped in normal runs. Explicit live smoke passed independently. Strict TypeScript and production build passed.
- Live disposable-account API integration passed: denied before consent, preference saved by its owner, authenticated Groq response, correct moisturizer/dry/₹500 filters, no product records generated, client consent/scan injection rejected, exact QA session revoked and account removed. No personal scan/photo/context was transmitted.
- Browser verified sample request filling, category navigation (moisturizers narrowed synthetic-demo eligibility to six), two-product comparison and clear, existing tracking URLs, disabled model search in demo, and 390px responsive layout with no horizontal page overflow. Preview: `../velqora-groq-product-search.png`; comparison: `../velqora-product-comparison.png`.


## Live discovery beyond the catalog · 2026-11-01

- Added default Across the web mode, separate from verified catalog filtering. The existing Groq key successfully used `openai/gpt-oss-20b` with required browser search; no new paid API/subscription or plan upgrade. Official Groq documentation verified that this tool is Exa-powered and cannot combine with structured outputs; retrieval and quote extraction are separate. Official OpenAI docs checked the open-weight model identity.
- Added `/api/products/discover`: existing auth/origin checks, owner-filtered saved AI consent, separate explicit per-request web acknowledgment, 5 requests/user/hour and no-store responses. Typed query only; no saved preferences/scans/photos/notes. No database schema or RLS change.
- Cards use only actual browser tool source metadata, not generated assistant product names/links. Facts are limited to exact excerpts present in opened source text. Unopened/missing/invalid excerpts remain unverified. Price excerpts require an INR/currency label and digits. No arbitrary server fetch of result URLs; unsafe link schemes/hosts/credentials/ports are rejected.
- Web discoveries remain separate from catalog eligibility; collection pages may appear. Added custom Experiment Lab prefill with editable name, validated public source link and clearly marked source notes. No catalog ID is invented. Updated privacy notice for Groq/Exa processing and non-retention of web results.
- 117 offline tests passed, 2 opt-in live tests skipped during normal runs. Production build and strict TypeScript passed. Explicit live web smoke passed.
- Live disposable-account integration passed: missing web acknowledgment rejected, saved AI consent enforced, actual web request found the official CeraVe India product page outside the catalog, literal ingredient/suitability excerpts returned, raw page text excluded from API output, exact temporary session revoked/account removed.
- Browser verified scope switching, demo disclosure/disabled model calls, and custom CeraVe tracking name/source-note prefills; no experiment submitted. Preview: `../velqora-live-web-discovery.png`.


## Scan-first source-supported product discovery · 2026-11-01

- Replaced the default manual shopping prompt with For my scan: selected scan, derived care plan, current preference summary and one Find products for my scan action after explicit sharing acknowledgment. No automatic external request on page load. Updated the scan-results CTA and removed the stale No generative AI wording.
- Server reads only an authenticated owned completed scan, validates provider interpretation and current preference schema, and constructs the search brief in code. Client-provided scores/skin age are rejected. Raw scores, private identifiers, photo paths and skin-age estimates never enter that brief. No schema/RLS changes.
- Dry/sensitive skin supplies a hydrating-care foundation. Relative low scores use the existing supported YouCam interpretation without invented clinical cutoffs. Tear troughs, eye bags, eyelids and limited dark-circle support produce guidance, not a corrective cream match. Actual age is never inferred.
- Added fixed checks against opened source product pages, ingredient statements, manufacturer skin suitability, category, budget/source claims and active-ingredient restrictions. Exclusions requiring full INCI remain unresolved rather than being cleared from excerpts. Matched cards explain why; missing evidence stays under needs verification. Product changes/scan changes invalidate the visible result and sharing state.
- 129 offline tests passed; 2 opt-in live smoke checks remain skipped during normal test runs. Tests cover dry-skin plan, structural guidance, unsupported versions, age handling, evidence gaps, budgets, exclusions, active ingredients and owned-scan API access.
- Live disposable-account/scan integration initially exposed retrieval variability (one provider failure, then insufficient source evidence). After checking source retrieval and bounded extraction, the final run passed without relaxing suitability checks: 1 source-supported personalized match, 5 sources needing review. Confirmed derived dry-skin target, no raw scores/ID in search brief, and evidence/reasons on each match. Exact test session revoked and fixture account/scans removed. No real user's scan data was transmitted.
- Browser verified For my scan is the default and requires a supported real scan in the synthetic demo. No real account’s sharing preferences were changed.

## Shared scan-discovery filters · 2026-11-01

- Existing concern chips, Use scan priorities, brand/category/text filters, price/rule ordering, full-ingredient toggle and list-length controls now also drive scan discovery. Selected concerns remain authoritative; dry skin does not silently substitute hydration for selected pores/eye concerns. Browse catalog switches to catalog mode; My product matches restores scan discovery.
- Changing filters reassesses retrieved products locally and renews acknowledgment before another external search. Sorting/list length do not trigger requests or reset consent. Retinoids honor explicit adult confirmation, avoidance and sensitive-skin choices. Preferred brands receive the same small ranking bonus as the catalog.
- Full-INCI and manufacturer-claim excerpts require source-backed verbatim text. Partial lists cannot satisfy the full-list control or clear ingredient exclusions. Tracking records the actual matched concern.
- 134 tests passed, with 2 optional live checks skipped; strict TypeScript and production build passed. Added regressions for authoritative concerns, category/brand/full-INCI filters, retinoid opt-in, structural-only guidance, price ordering, source quote validation and API filter validation.
- Live disposable-account/scan integration passed: one source-supported match, five sources needing review, owned-scan checks and private-field omission verified. Fixture account/session/scan removed; no actual user scan transmitted. Browser tested combined Dot & Key/moisturizer/full-INCI filters and ascending price ordering: five eligible catalog products. Preview: ../velqora-shared-product-filters.png.

## Dry-skin web retrieval and evidence gaps · 2026-11-01

- Reproduced the reported selection with a disposable synthetic dry-skin scan and explicit pore/dark-circle/tear-trough choices. Initial live attempt found no qualified matches; server logging showed the evidence-extraction request hit the free provider quota. This was previously indistinguishable from genuinely missing product facts.
- Added explicit evidence-unavailable status and UI notice; zero web matches no longer imply the separate catalog has no eligible choices. Renamed the web section to distinguish its count from catalog matches.
- Search now includes the requested skin type as a mandatory constraint, excludes marketplace grids, and can start from up to two currently eligible public catalog product URLs while continuing beyond the catalog. References do not count as live evidence and do not bypass any checks.
- Replaced prefix-only extraction with bounded contiguous evidence spans, retaining late suitability/formula/price statements. Verbatim checks still use the original opened page. Added regressions for evidence after long navigation/marketing blocks and extractor unavailability. 138 offline tests pass, with 2 opt-in live checks skipped.

- Final live reproduction still returned zero qualifying additional web products despite successful ownership, derived-target and privacy checks. Retrieval included blocked/empty pages; checks were not relaxed. The positive-match live assertion remains failing and this is an external retrieval limitation, not reported as a successful end-to-end recommendation. Exact disposable fixtures were removed. When the catalog has matches and web discovery has none, catalog cards now appear first; web gaps follow below. Production build and strict TypeScript pass.
