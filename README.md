# Velqora

See Beyond Your Skin. Track What Truly Works.

A responsive Next.js application for cosmetic skin analysis, longitudinal measurement comparisons, and skincare routine experiments. The live application uses Supabase Auth/PostgreSQL/private Storage and server-side YouCam v2.1 requests. A separate, clearly labeled synthetic demo runs without provider credentials.

## Start locally

Use Node 22.12+ LTS or Node 24+ LTS. The source uses strict TypeScript, Tailwind 4, a shadcn-style Radix/CVA button, Lucide, Framer Motion, and Recharts.

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Open the printed localhost URL. Choose **Explore the demo** to see synthetic history immediately. Demo actions persist only in that browser's local storage. Photos selected in demo stay in the browser; demo analysis adds an explicitly synthetic fixed fixture, not scores derived from the photo. Demo mode never authorizes live backend APIs and never runs as a fallback to failed real analysis.

The lockfile pins the installed versions. `.npmrc` makes peer resolution reproducible; required Recharts and test-runner peers are explicitly installed. Google Fonts are loaded by CSS with system-font fallbacks.

## Configure the live application

1. Use the configured agriguard project, or create a Supabase project for a separate environment. Apply the files in `supabase/migrations/` in order using the SQL editor, or use Supabase CLI migrations. The second migration hardens permissions for a reused project. Apply this migration to a new database before registering users; its trigger creates profiles for new accounts.
2. Copy the Supabase project URL, anonymous key, and **server-only** service-role key into `.env.local`. Set the project's Site URL and allow `http://127.0.0.1:3000/auth/callback` and your deployed `/auth/callback` URL as authentication redirect destinations. Email confirmation is supported.
3. Set `YOUCAM_API_KEY` from your Perfect Corp. account. The v2.1 base URL is prefilled. Check your account's available credits and permitted actions.
4. Confirm that your applicable YouCam terms permit retaining numerical outputs for history. Only then set `HISTORY_RETENTION_ENABLED=true`. Live scans are explicitly unavailable while this flag is off; no synthetic substitute is generated.
5. For free-tier AI Insights, create a key at https://console.groq.com/keys on the **Free plan**, add `GROQ_API_KEY` to `.env.local`, review https://console.groq.com/docs/your-data, and set `LLM_DATA_SHARING_ENABLED=true`. Restart the server, then opt in through **Settings → external AI sharing**. Never commit the key. Default model: `qwen/qwen3.8-27b` (preview; override with `GROQ_MODEL` if availability changes). Groq publishes quota limits at https://console.groq.com/docs/rate-limits; free is quota-limited, not unlimited. Keep paid billing disabled for a no-cost setup. This uses Groq, without an OpenAI API subscription. No automatic paid fallback exists.

   Without configuration/consent, responses are labeled reference guidance (or numerical summaries for scan questions). Configured model failures show actionable errors, including free quota exhaustion; they never masquerade as model answers. Optional other HTTPS compatible providers require explicit `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL` configuration and may charge.

   The assistant answers general cosmetic skincare questions using reviewed AAD reference notes and existing concern guidance, and explains up to three authorized completed scans plus five experiments. Photos, storage paths, account/scan IDs and capture notes are excluded; usage notes are capped. It does not diagnose, prescribe, promise results or generate product matches. Model instructions are safeguards, not a clinical accuracy guarantee. Product eligibility remains entirely rule-based.
6. Set `IMAGE_RETENTION_HOURS` (1–168; default 24). Set a random `CRON_SECRET` and schedule `/api/maintenance` with `Authorization: Bearer <CRON_SECRET>` at least daily. `vercel.json` includes a daily job. Confirm your Vercel plan supports the schedule. Files expire at the configured time; cleanup can lag by a cron interval. The image API rejects expired photos. Signed provider links last 10 minutes, and viewer links last 60 seconds.
7. Register, confirm the email if required, complete privacy onboarding, and submit an explicitly consented JPEG or PNG face photo. Images must be under 8 MB, at least 256 × 256 pixels, and within a 25-megapixel decode limit. Uploads are capped before multipart parsing; Sharp verifies decoding, rotates, downsizes, strips metadata, and encodes JPEG. WebP is intentionally not accepted until supported input formats are verified.

Do not commit `.env.local`. Only the Supabase URL and anonymous key belong in `NEXT_PUBLIC_` variables. Provider/service-role credentials never enter client bundles.

## Architecture and persistence

- `app/`: all specified pages and authenticated route handlers; `proxy.ts` refreshes auth cookies. Server layouts protect real workspace pages. Every live API independently verifies the Supabase user.
- `components/`: responsive sidebar/mobile navigation, application state, charts, upload, reusable cards and forms.
- `lib/youcam/`: server-only provider client and Zod response parser. SD actions preserve the blueprint's exact IDs. All 15 indicators plus regional skin type are requested.
- `lib/progress.ts`: deterministic matching by metric ID, region, completed state, and provider version; percentages are unavailable at a zero baseline. Missing measurements remain unavailable.
- `lib/ai/`: server-only configurable LLM adapter. Relevant authorized measurements and precomputed changes are supplied, never photos. User notes are treated as untrusted input. Explanations are prompted to avoid diagnosis, causal claims, invented data, and provider-specific score interpretation and no invented severity cutoffs.
- `supabase/migrations/`: eight core tables, indexes, foreign keys, uniqueness, private bucket, RLS, and auxiliary atomic quota/polling functions.

Browser sessions can only read their own records. Validated server handlers perform writes with the service role and explicit user filters. Child-table RLS checks the owning parent. Service functions are revoked from `anon` and `authenticated`. There are no browser storage policies; image access goes through an authenticated ownership check and short-lived URL.

Scan creation is keyed by a client UUID unique per user. Repeating the same request returns the existing scan without resubmitting a provider task. Polling never creates a task. A database claim limits external polling to one request per scan every 10 seconds. Completion locks the scan and inserts measurements transactionally; repeated completion does not add duplicate metrics. Original provider IDs, both UI/raw scores, regions, provider version, and dates are retained. Raw provider responses and temporary mask URLs are deliberately not stored. Available provider visualizations can be loaded explicitly from the saved task and may have expired.

The UI polls for up to three minutes. Slow tasks remain recoverable through **Resume checking**. Reloading a processing scan uses the persisted task identifier. Submission timeouts are inherently ambiguous without a provider idempotency contract: a task might exist even if its ID was not received. The app never retries task creation automatically. An interrupted pending submission becomes failed after two minutes and tells the user a new scan may spend another credit.

User quotas are shared in PostgreSQL: 5 new scan submissions/hour, 120 poll requests/10 minutes (plus the per-scan 10-second claim), 20 insight requests/hour, 30 experiments/hour, and 100 usage updates/hour. Supabase controls authentication abuse; configure its own auth rate limits/CAPTCHA policies to suit your deployment.

Scan deletion marks the record as deleting before removing storage and database rows; deletion failure can be retried. Uploads compensate when deletion races submission. Full application-data deletion removes scans/photos, experiments/logs, insights, consent, and profile preferences while preserving the login account. Third-party retention is governed by provider terms, and previously issued links remain valid until expiration. Baseline deletion leaves an experiment's baseline unavailable rather than inventing a new baseline.

## Routes

`/`, `/login`, `/signup`, `/onboarding`, `/dashboard`, `/scan`, `/scan/[id]`, `/progress`, `/progress/compare`, `/experiments`, `/experiments/new`, `/experiments/[id]`, `/insights`, `/settings`.

Additional routes: `/demo`, `/privacy`, and `/auth/callback`.

APIs include scans/list/status/image/deletion; progress/selected-scan comparison; experiments/status/logs; insights; account/profile/data deletion; consent; and authenticated maintenance. Errors follow `{ "error": { "code": "...", "message": "..." } }`.

## Verification

```sh
npm run typecheck
npm test
npm run build
npm audit
```

Unit and mocked-handler tests cover parsing, special/missing/duplicate metrics, score matching, state transitions, timeouts, provider failures, consent/retention boundaries, upload validation, experiment validation, authentication, ownership filters, atomic quota failure, and duplicate submissions. These do **not** substitute for live Supabase RLS or paid provider tests.

Run `supabase/tests/security.sql` in your Supabase SQL editor to exercise RLS and transactional completion with two temporary test users. It wraps all fixtures in a rollback. Run it in a disposable development project first. Supabase authentication, storage, SQL execution, and isolation were subsequently verified on agriguard (see the connected-project section below). Real successful YouCam output and email delivery remain to be verified.

Before submission, complete these live checks:

- Register two accounts and confirm onboarding/expired-session behavior.
- Submit a real consented photo. Verify the provider task ID, successful result, all returned metrics, storage cleanup, and missing-output handling.
- Submit a second real scan; verify history and exact selected-pair comparison.
- Create/log/complete an experiment. Ask a grounded insight with LLM configured and consented.
- Try user B's scan, image, experiment, and insight IDs from user A. APIs must deny access; direct database queries must be hidden by RLS.
- Repeat the same submission UUID; verify one provider task. Refresh during processing and retry result reads; verify one result set.
- Test malformed photos, no consent, provider credit exhaustion/errors, slow tasks, deletion, and maintenance.

## Deploy to Vercel

This project intentionally retains the requested Next.js/Supabase/Vercel stack. A static export cannot serve authenticated provider APIs. Sites hosting runs Workers and would require a separate runtime adaptation; no deployment is represented as complete here.

1. Put this project in your Git repository and import it into Vercel with the Next.js preset; select this directory as the root if needed.
2. Configure Node 24 LTS and all environment variables in the appropriate environments. Use a production Supabase project and update allowed auth redirect URLs.
3. Build with `npm run build`. Deploy, then confirm the scheduled maintenance authorization and execution.
4. Keep synthetic demo enabled for judges if desired, but show the banner during every demo. Disable with `NEXT_PUBLIC_DEMO_ENABLED=false` and rebuild if needed.
5. Run the live checks above from the deployed HTTPS URL before calling the app production ready. Monitor provider credits and server error rates without logging secrets or signed URLs.

## Three-minute judge demo

- **0:00–0:30**: Introduce the product on the landing page. Open the explicitly synthetic demo and explain its data boundary.
- **0:30–1:00**: Show the dashboard, all 15 indicators, history, and a deterministic comparison.
- **1:00–1:40**: Create an experiment with a baseline, save a usage note, and explain why observations don't establish causation.
- **1:40–2:10**: Ask an insight; identify its source as deterministic or configured AI. Show privacy and deletion controls.
- **2:10–3:00**: With the live environment ready, exit demo, sign in, show a real completed YouCam result and its persisted history. Prepare the real scan ahead of the presentation; asynchronous completion can exceed three minutes.

See `VERIFICATION.md` for the actual check results and remaining live-environment limits.


## GitHub

The source repository is `https://github.com/Yj2992/dermalens` (private).
GitHub Actions runs strict TypeScript, the behavior test suite, a production build,
and a production dependency audit on main pushes and pull requests. The workflow
uses Node 24 and SHA-pinned actions; Dependabot proposes dependency updates weekly.
CI uses no provider credentials and makes no live skin-analysis requests.

Velqora is now connected locally to the existing agriguard Supabase project. Live website deployment is still pending.


## Connected Supabase project (16 October 2026)

Velqora reuses **agriguard**, project ref `bqsmamuarzwkdtmmvmyo`, in `us-east-2`.
The legacy `public.scan_results` table (21 records) and public `scans` bucket were preserved.
Velqora uses its own tables and the separate **private** `skin-photos` bucket.

Both migrations were applied and recorded. Browser roles have read-only access to
own rows through RLS; writes and server RPCs require authenticated backend handlers.
The Auth profile trigger runs from a private schema. Project keys are configured only
in ignored `.env.local`, restricted to the local user. They are not stored in GitHub.

Local callback URLs for both `localhost:3000` and `127.0.0.1:3000` were added to the
existing Auth allowlist. Email confirmation remains enabled. Before deploying,
add the deployed HTTPS `/auth/callback` URL and configure the deployment environment
with the keys from your Supabase project. Do not paste secret keys into source code.

For an optional live smoke test, start `npm run dev` in one terminal and run
`npm run test:integration` in another. It uses the configured project, generates two
short-lived QA accounts through no-email signup links, checks auth/RLS/consent/profile
APIs and private storage, signs out sessions, and deletes only its exact test users
and object. It sends no emails or YouCam requests and creates no synthetic scan scores.
Do not run it against a project you are not authorized to test.

The Supabase security advisor reports no errors. Existing legacy scan policies and
public bucket produce warnings; signed-in GraphQL discovery of Velqora tables is
also reported because authenticated users intentionally have RLS-protected SELECT
access. These are not anonymous access grants. The two-user isolation checks passed.

The CLI's temporary `cli_login_postgres` role encountered a platform permission error
after initial SQL execution; verification and migration history recording were completed
through the dashboard. No managed database roles were modified as a workaround.

YouCam credentials and verified numerical-output retention permissions are still
required before setting `HISTORY_RETENTION_ENABLED=true`. External AI remains off
until configured and the user opts in. This setup does not claim a paid provider scan
or website deployment has been verified.

### HEIC uploads

Scan uploads accept JPEG, PNG, HEIC and HEIF files up to 8 MB. HEIC is decoded on the server using libheif WASM, then resized and stripped of metadata before private JPEG storage and YouCam submission. Browsers without HEIC preview support show the selected filename. The server validates container bytes and decoded dimensions (256 px minimum, 25 million pixels maximum); file extensions alone are not trusted. Only the first image of a multi-image container is analyzed.

### Live YouCam upload verification — 16 October 2026

API authentication and unit-balance checks passed. A real task exposed a provider downloader failure on long Supabase signed URLs. Submission now registers a file with YouCam, uploads the stripped JPEG with the returned PUT instructions, and submits its file ID. A live recovery verified that this upload flow works: YouCam returned a terminal face-angle rejection within the first 10-second status check. No successful scan scores were produced in that check. Null results on running/failed tasks are accepted, terminal errors are shown with safe actionable messages, and polling no longer leaves a spinner running after automatic checks stop. Provider error text is never echoed because it can contain signed links.

### Automatic face framing

Before storage and provider submission, the server corrects orientation, detects a single face locally, and crops excess background to target approximately 68% face width while preserving forehead/chin margins. The bundled detector runs offline; no additional service receives photos. No face boxes are persisted. Already close portraits, undetected/ambiguous faces, and crops below the 256-pixel minimum remain unchanged for provider validation. Cropping never upscales a photo or synthesizes facial detail. A side-facing, obstructed, very distant, or blurry face can still require a new photo. Vendor model files are explicitly included in the Next.js server deployment trace.

A subsequent live scan completed successfully. Its existing YouCam output was recovered after correcting nullable optional `error` and `url` fields; completed status, all 15 measurements and 3 regional classifications were verified in Supabase.

### Optional Fitzpatrick estimate

Completed real scans now offer a separate consent checkbox and “Add Fitzpatrick estimate · 10 units” action. The feature reuses the unexpired retained JPEG, validates the provider’s 320–4096 px limits, uploads via the YouCam File API, and runs asynchronous face pre-processing before classification. Only exactly one detected face proceeds to the V1.0 classification (`version: 1.0`, `index: 0`); the photo is never silently assigned to one of several faces. A unique scan ID and atomic phase/poll claims prevent duplicate submissions. Refreshing/checking an existing estimate never starts another skin scan. Provider task IDs and raw responses stay server-side; only the I–VI estimate and status are returned to the browser. Interrupted submissions fail closed rather than automatically resubmitting a potentially charged task. Results cascade-delete with their parent scan.

The official documentation lists 10 units per successful classification. Face pre-processing and classification are separate task phases. See https://docs.perfectcorp.com/reference/ai_fitzpatrick_skin_type for current terms and costs. A photo-based classification is an estimate, separate from dry/normal/oily skin, and cannot establish personal burning/tanning history. No ethnicity, safe tanning duration, or personalized SPF is inferred. The pasted provider table repeats Type V and omits IV; the implementation uses the API’s canonical enum I, II, III, IV, V, VI.

The migration `20261016144240_add_fitzpatrick_analysis.sql` is applied to agriguard. RLS owner/non-owner checks and column grants passed in a rolled-back transaction. A live paid classification remains to be tested through the consent button. The security advisor reported no errors; signed-in GraphQL schema visibility is intentional with RLS (https://supabase.com/docs/guides/database/database-linter?lint=0027_pg_graphql_authenticated_table_exposed). Existing legacy public scan visibility and disabled leaked-password protection remain separate project notices (https://supabase.com/docs/guides/database/database-linter?lint=0026_pg_graphql_anon_table_exposed and https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

### Rule-based Indian skincare product discovery

`/products` now provides a curated 100-product catalog from five official Indian stores, fixed rules covering all 15 YouCam indicators, private budget/ingredient/skin-type preferences, source links and verification dates. There are 54 captured full ingredient lists and 46 key-ingredient-only records; unknown suitability is preserved and conservative filters exclude incomplete/unknown facts. No LLM or generative model is used for recommendations. YouCam higher-favorable score direction is documented, but no clinical severity cutoffs or product efficacy predictions are invented.

Scan results link to product matches. “Track This Product” pre-fills a catalog-linked experiment; usage logging and future same-provider comparisons use the existing Lab. The Supabase catalog migration and 100 active records are applied to the existing agriguard project. See [product research, rules, provenance and maintenance](docs/PRODUCT-RECOMMENDATIONS.md). Import curated updates with `node scripts/import-product-catalog.mjs`; run the isolated live workflow check with `node scripts/verify-products.mjs` while the app is running. Product data older than 30 days is excluded until reverified.

### Live camera capture

The new-scan screen supports a front-camera live preview, camera switching, JPEG capture, review and retake alongside existing JPEG/PNG/HEIC uploads. Camera access requires HTTPS or localhost and browser permission. Audio is never requested. Streams stop after capture, cancellation, switching cameras or leaving the screen; a permission request resolving after cancellation is immediately stopped. Only the chosen still photo is uploaded through the existing consent-protected analysis flow. Demo mode never uploads a photo.


### Groq-assisted Find Products · verified catalog mode

The verified catalog mode on `/products` accepts a natural-language shopping request. The existing Groq key/model and server sharing switch are reused; each signed-in user must enable AI sharing first. Groq receives only the typed request and public filter vocabulary. It receives no saved profile, scans, photos, preferences or experiment notes from this feature. Demo mode never calls Groq.

Groq converts the request into a strict, server-validated filter schema. The user reviews the interpretation before applying it. The existing rule engine still determines product eligibility, ranks matches and supplies explanations. All names, prices, ingredients, images and official purchase URLs remain catalog records. This feature does not browse the web, verify live prices, create new products or claim that unknown manufacturer properties are satisfied. Unsupported requirements block applying the interpretation until the request is refined.

Existing ingredient exclusions, lower budgets, sensitive-skin restrictions, adult confirmation and retinoid avoidance cannot be relaxed by the parser. Applied filters are local until the user explicitly saves preferences. New search constraints compose with the existing manual filters; removing the AI-specific category/brand/ingredient constraints preserves the updated safety/preferences controls, which remain visible in the sidebar. The endpoint enforces authenticated ownership of the consent record, 10 requests/user/hour, a bounded response and timeout, and honest quota/provider errors without paid fallback.

The page also provides category shortcuts and up-to-three-product factual comparison with source links. Track This Product continues to use the canonical product ID and Experiment Lab flow.

Verification commands:
- `npm test`: offline tests, including schema validation, consent/ownership gates, and preserved safety constraints.
- `RUN_GROQ_SEARCH_SMOKE=true npx vitest run tests/product-search-live.test.ts`: explicit live generic-query check (requires configured Groq key).
- `npm run test:product-search`: live disposable-account consent-to-search API check using the local server and configured Supabase project; revokes the test session and removes the exact temporary account. Never prints credentials or sends real scan/profile context to Groq.


### Across the web · live product discovery

Across the web is an optional manual search scope and is not restricted to the 100 catalog records, their brands or stores. It uses the existing Groq key with `GROQ_WEB_SEARCH_MODEL=openai/gpt-oss-20b`, a Groq-hosted open-weight model with built-in Exa browser search. No OpenAI API key or subscription is used. Model/search access is subject to the Groq account's free plan limits; no paid fallback or billing upgrade is performed.

A signed-in user must have saved external-AI consent and separately acknowledge the Exa-powered web search before each changed request. Only the typed request and public instructions are transmitted. No saved user preferences, scan measurements, photos or experiment notes are used for this search. Five searches per user/hour are allowed. Demo mode does not call it.

The model performs live searches and opens relevant India-focused product pages, preferring official sites and established retailers. The app derives at most six source cards from the actual browser tool metadata, ignoring product names/URLs in the generated assistant answer. A second bounded extraction step proposes literal price, ingredient and suitability excerpts; the application accepts each only if it occurs in retrieved page text. Missing, ambiguous or failed extraction stays unverified. HTTPS public-host link validation rejects unsafe schemes, credentials, local hosts and unusual ports. Our server never fetches arbitrary result URLs directly.

These are web source discoveries, not fully verified product eligibility recommendations. Collection pages can appear. Source statements are seller claims, and exact packs, prices, availability, full ingredients and suitability must be reviewed on the source and received label. Saved catalog preferences are not automatically sent or applied to web results. Discoveries never silently enter the verified catalog. Track as custom product prefills an editable name and public source in Experiment Lab; it uses no catalog product ID.

Verification: `RUN_WEB_DISCOVERY=true npm run test:product-search` tests the authenticated consent-to-live-search endpoint with a disposable account and removes it afterward. `RUN_GROQ_WEB_SMOKE=true npx vitest run tests/web-product-search-live.test.ts` runs a generic live CeraVe source check. Both send only non-personal test requests.

Provider references: https://console.groq.com/docs/tool-use/built-in-tools/browser-search and https://console.groq.com/docs/rate-limits. Browser search does not support strict structured output in the same call, so retrieval and schema-validated quote extraction are separate.


### Scan-first personalized web discovery

Find Products now defaults to **For my scan**. A selected completed scan (including the scan-result `?scan=` link) drives the search without a typed shopping request. The server fetches that scan with the authenticated owner ID and completed status; client-supplied scores/skin age are rejected. Unsupported provider versions are not automatically interpreted.

`lib/products/scan-discovery.ts` builds a deterministic plan: selected concern chips are authoritative; supported lower UI scores supply default relative cosmetic priorities without diagnostic thresholds. Empty concern selection allows basic-care browsing, with hydration for dry/sensitive skin. Structural eye concerns remain guidance-only; limited cosmetic support carries its published limitations. Skin age and Fitzpatrick estimates never establish actual age or active-ingredient eligibility. Retinoids require explicit adult confirmation and opting out of avoidance, and remain excluded with conservative sensitive-skin filtering. Skin-age estimates never grant eligibility.

With the user’s explicit scan-search acknowledgment and saved AI consent, only a derived care brief (skin type, cosmetic targets and current selected preferences) goes to Groq/Exa. No photo, raw scores, scan ID, account details, skin-age estimate or experiment notes are transmitted. The exact brief can be reviewed in the UI. Product discovery does not start on page load.

Retrieved pages then pass fixed source-evidence checks: opened individual product page, supported category, manufacturer-listed skin suitability, ingredient and category support for the selected concerns, current preference claims, budget evidence when specified, and active-ingredient restrictions. Ingredient excerpts alone cannot clear ingredient exclusions; such sources remain under needs verification until a complete formula is checked. Missing facts never count as satisfied. Explanations distinguish everyday-care foundations from targeted ingredient support; no product-effect prediction is made.

The source-supported shortlist is shown first, with why-it-appears explanations and tracking links tied to the selected baseline. Other sources remain separate under needs verification. The same concern, brand, category, product/ingredient text, full-INCI, budget, ingredient exclusion and claim controls filter catalog and scan discovery. Changing filters immediately reassesses retrieved sources locally; new discovery uses the updated brief after renewed sharing acknowledgment. Sort and list-length changes are local. Switching scans hides the old shortlist. Full-INCI status requires a verbatim headed formula from an opened page; excerpts cannot clear ingredient exclusions. The existing verified catalog and optional manual discovery remain available.

Run `RUN_SCAN_DISCOVERY=true npm run test:product-search` for an explicit generic dry-skin test with a disposable scan/account. It uses a derived synthetic test brief, verifies an actual live source-supported match, then revokes the test session and removes the exact account/fixtures.

Web discovery explicitly searches for manufacturer suitability for the selected skin type alongside ingredient/category targets. Opened page retention is bounded to 60,000 characters, then evidence-focused contiguous spans (up to 5,000 characters total) preserve late suitability, formula, claim and price sections for extraction. Quotes still must match the original opened page; navigation skin-type links and generic non-drying claims cannot establish suitability. Zero web matches are labeled separately from the independently verified catalog matches.

`RUN_SCAN_DISCOVERY=true RUN_SCAN_PORES=true npm run test:product-search` exercises the reported dry-skin / tear-trough, dark-circle and pore selection with an explicit synthetic adult retinoid opt-in; no actual user's scan or preference is transmitted.

Scan discovery supplies up to two currently eligible public catalog product URLs as retrieval leads and continues searching other brands. A lead is never substituted for live source evidence. If the separate extraction step fails (including free-provider quotas), the response carries `evidence_status: unavailable`; the UI explains why details could not be checked instead of implying no suitable product exists.

Product-search quota failures pause external search controls until explicit user re-enablement. Catalog filtering and tracking remain available, and failed refreshes retain previous retrieved results. No automatic retries or guessed quota reset time are introduced.
