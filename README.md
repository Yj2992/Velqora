# DermaLens

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
5. Optionally configure an HTTPS OpenAI-compatible Chat Completions endpoint with `LLM_BASE_URL`, `LLM_API_KEY`, and `LLM_MODEL`. Confirm the provider's structured-data processing terms and set `LLM_DATA_SHARING_ENABLED=true`. Each user must also opt in through Settings. Otherwise responses are labeled **deterministic summaries**. A configured LLM failure produces an error, not a fabricated answer or silent fallback.
6. Set `IMAGE_RETENTION_HOURS` (1–168; default 24). Set a random `CRON_SECRET` and schedule `/api/maintenance` with `Authorization: Bearer <CRON_SECRET>` at least daily. `vercel.json` includes a daily job. Confirm your Vercel plan supports the schedule. Files expire at the configured time; cleanup can lag by a cron interval. The image API rejects expired photos. Signed provider links last 10 minutes, and viewer links last 60 seconds.
7. Register, confirm the email if required, complete privacy onboarding, and submit an explicitly consented JPEG or PNG face photo. Images must be under 8 MB, at least 256 × 256 pixels, and within a 25-megapixel decode limit. Uploads are capped before multipart parsing; Sharp verifies decoding, rotates, downsizes, strips metadata, and encodes JPEG. WebP is intentionally not accepted until supported input formats are verified.

Do not commit `.env.local`. Only the Supabase URL and anonymous key belong in `NEXT_PUBLIC_` variables. Provider/service-role credentials never enter client bundles.

## Architecture and persistence

- `app/`: all specified pages and authenticated route handlers; `proxy.ts` refreshes auth cookies. Server layouts protect real workspace pages. Every live API independently verifies the Supabase user.
- `components/`: responsive sidebar/mobile navigation, application state, charts, upload, reusable cards and forms.
- `lib/youcam/`: server-only provider client and Zod response parser. SD actions preserve the blueprint's exact IDs. All 15 indicators plus regional skin type are requested.
- `lib/progress.ts`: deterministic matching by metric ID, region, completed state, and provider version; percentages are unavailable at a zero baseline. Missing measurements remain unavailable.
- `lib/ai/`: server-only configurable LLM adapter. Relevant authorized measurements and precomputed changes are supplied, never photos. User notes are treated as untrusted input. Explanations are prompted to avoid diagnosis, causal claims, invented data, and unverified score direction.
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

DermaLens is now connected locally to the existing agriguard Supabase project. Live website deployment is still pending.


## Connected Supabase project (16 October 2026)

DermaLens reuses **agriguard**, project ref `bqsmamuarzwkdtmmvmyo`, in `us-east-2`.
The legacy `public.scan_results` table (21 records) and public `scans` bucket were preserved.
DermaLens uses its own tables and the separate **private** `skin-photos` bucket.

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
public bucket produce warnings; signed-in GraphQL discovery of DermaLens tables is
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
