# DermaLens product discovery

Implemented 16 October 2026. This feature uses fixed rules and a curated factual catalog. It does not call an LLM, generate product facts, infer diagnoses, or predict a treatment result.

## Catalog and provenance

The initial catalog contains **100 distinct available product records from five official Indian stores**: Minimalist (28), Dot & Key (24), Deconstruct (20), Plum (19), and Re’equil (9). There are 33 normalized ingredient entries. Other requested example brands can be added when comparable official India price and ingredient facts have been verified; their missing facts have not been guessed.

The source records are from these official public store feeds, retrieved and reviewed on 16 October 2026:

- https://beminimalist.co/products.json?limit=250
- https://www.dotandkey.com/products.json?limit=250
- https://thedeconstruct.in/products.json?limit=250
- https://plumgoodness.com/products.json?limit=250
- https://www.reequil.com/products.json?limit=250

`data/products.catalog.json` is the curated import snapshot. `data/product-source-records.json` preserves the 100 underlying product records, keyed by stable product ID. Each product has an official purchase URL, official image URL, available variant ID, observed INR price, exact variant label (or explicitly unknown size), verification timestamp, source URL and SHA-256. The digest covers the individual source product JSON serialized with sorted keys, UTF-8, and Python's default JSON separators; it is not a hash of the entire store feed. Unit tests verify names, variant availability, prices and hashes against these retained records.

**54 products have captured published full ingredient lists; 46 have manufacturer-named key ingredients only.** Full INCI extraction used dedicated ingredient blocks on official product pages, not navigation or cross-sell text. Normalized actives may also come from the product's explicit title. Ingredients, suitability and free-from claims remain manufacturer information, not independent clinical certification. Unknown skin suitability is an empty list; unknown fragrance-free/vegan/non-comedogenic status is null. Forty-three records have no explicit verified skin-type suitability in the captured sources and are excluded when a specific skin type is required.

Price is the listed price of one named available variant, not a universal lowest price, guaranteed promotion, shipping quote, or per-ml comparison. Tinted variants are shown by their actual source shade; shade suitability is not inferred. Availability is a source-time observation and may vary by PIN code. Ingredients and offers can change. A few source pages mention formulation changes; the record carries a warning. Ingredient exclusion requires a complete ingredient list and is not an allergy-safety guarantee.

## Interpreting scans

YouCam's [skin analysis reference](https://docs.perfectcorp.com/reference/ai_skin_analysis) and [official integration explanation](https://www.perfectcorp.com/business/blog/ai-skincare/skin-analysis-api-claude-mcp-integration) describe higher scores as more favorable. UI scores are presentation-adjusted, not a validated clinical severity scale.

Only completed scans with provider `youcam-v2.1-sd` are eligible for automatic focus. The engine suggests the three lowest available whole-face UI scores in the documented 1–100 range, excluding 100. There are **no invented mild/moderate/severe thresholds**. Missing or unsupported-provider data yields no automatic concerns. Users can override every focus. Skin type comes from the whole-face classification or an explicit preference. Fitzpatrick estimate, perceived skin age, ethnicity and race are not recommendation inputs.

## All 15 indicators

| Indicator | Rule categories and ingredient families | Limitation |
| --- | --- | --- |
| Acne appearance | Cleanser/serum with salicylic acid | Does not diagnose acne or replace assessment of persistent/scarring breakouts |
| Redness | Gentle cleanser/moisturizer with glycerin, ceramides, hyaluronates, panthenol, oat | Limited comfort/barrier support; no rosacea/allergy treatment claim |
| Age spots | Serum/moisturizer/sunscreen with verified UV filters, vitamin C, azelaic/kojic/glycolic acid or retinol/retinal | Uneven pigmentation appearance; changing spots need assessment |
| Radiance | Hydrating/vitamin C serum or moisturizer | Cosmetic, lighting-dependent appearance |
| Moisture | Moisturizer/serum/toner with humectants and emollients | No barrier-health or eczema diagnosis |
| Oiliness | Niacinamide/salicylic-acid serum, cleanser or moisturizer | Limited, formulation-specific evidence; cannot predict sebum reduction |
| Pores | Salicylic-acid or retinol/retinal cleanser, serum or moisturizer | Cannot permanently close pores |
| Texture | Hydrating or selected resurfacing serum/moisturizer/toner | Actives may irritate; not a layering recommendation |
| Firmness | Hydrating/retinol surface care | Limited; creams cannot lift sagging tissue |
| Dark circles | Eye-care moisturizer with glycerin/hyaluronates | Limited dryness-related support; anatomy/pigmentation/allergy causes are not inferred |
| Eye bags | Guidance; no corrective cream recommendation | Cannot reliably correct fat protrusion or loose supporting tissue |
| Tear troughs | Guidance; no corrective cream recommendation | Topicals cannot fill an anatomical hollow |
| Upper eyelids | Guidance; no lifting product recommendation | Drooping position cannot reliably be corrected by skincare |
| Lower eyelids | Guidance; no repositioning product recommendation | Facial actives are not recommended on eyelids based on scan scores |
| Wrinkles | Hydrating or selected retinol/retinal/vitamin C serum/moisturizer | Modest surface appearance support; no deep-fold removal claim |

The exact ingredient IDs, category checks, explanatory text, limitations and primary guidance URLs live in `lib/products/rules.ts` and are mirrored into concern tables for audit. AAD, Mayo Clinic and a published niacinamide clinical trial inform these rules; they do not validate individual catalog products. Runtime rule changes require code review and deployment, with the versioned database mappings imported at the same time.

## Filtering and ranking

Hard filters run before ranking: available variant; positive price; verification no older than 30 days; per-product budget; explicitly supported skin type; required manufacturer claims; ingredient avoidance; and conservative active-ingredient preferences. Unknown suitability or incomplete INCI is never silently treated as safe. Canonical aliases handle examples such as parfum/fragrance and vitamin C/ascorbyl derivatives. The avoidance list is finite and substring/alias-based; it cannot certify all allergens or synonyms.

Retinoids are excluded by default. Retinoids and recognized exfoliating ingredients/products require explicit adult confirmation. Selecting sensitive skin or the conservative sensitive-skin filter excludes these actives and requires full INCI plus an explicit fragrance-free claim. Actual age is never taken from the scan's skin-age estimate. Retinoid guidance warns against use during pregnancy/breastfeeding. A score does not establish suitability for an active ingredient.

A product must match both a concern's ingredient and category. Structural-only selections return guidance with zero corrective product matches. With no concerns, basic cleanser/moisturizer/sunscreen categories can be browsed. Catalog browse removes concern matching while retaining preference restrictions.

Internal sorting weights: 10 per matched concern, 2 per matched ingredient, 2 for a complete ingredient list, 2 for confirmed skin-type suitability, 1 for a preferred brand. Ties use price then stable ID. These are transparent merchandising weights, not probabilities, severity cutoffs, or clinical match percentages. Search, brand, category and price ordering refine the eligible results.

## Screens and workflow

1. A completed scan has **Find Products**, carrying that scan ID to `/products`.
2. `/products` presents focus chips for all 15 indicators, limitations/evidence, source-checked product images, INR prices/variant labels, named ingredients, source dates, suitability and expandable full details. Personal preferences are optional and can be saved privately.
3. **Official store** opens the exact observed variant on the brand's store. DermaLens does not accept payment or claim live checkout availability.
4. **Track This Product** opens the existing new-experiment screen with the canonical product ID/name, selected owned baseline and an available target metric. A completed baseline is required. Users can switch to a custom product.
5. Creation validates product identity server-side, validates baseline ownership and metric availability, then stores the optional product foreign key. The browser's submitted product name is not trusted for linked products.
6. Existing daily usage logging, pause/complete controls and same-provider follow-up comparison work as before. Numerical changes remain observations; they do not prove the product caused them. Without a follow-up scan, the UI says comparison is pending.

Demo mode uses real catalog facts with explicitly synthetic scan data. Demo preferences are visit-only; demo experiments are browser-local. No paid YouCam operation is needed to browse or track a product.

## Database, privacy and maintenance

Migration `20261016153500_add_verified_product_catalog.sql` creates brands, sources, ingredients, concerns, concern-ingredient mappings, products, product-ingredient mappings, product-source mappings, variant price history and private preferences. It adds a nullable catalog-product reference to existing experiments and expands product names to 240 characters. Old manual experiments remain valid. Indexed foreign keys support growth; product IDs remain stable across imports and price/source history is retained.

Catalog facts are intentionally publicly readable through RLS; curation writes require the server service role. Inactive products and their price/ingredient joins are hidden from browser roles. Preference reads are owner-only and writes go through authenticated, origin-checked handlers. Account data deletion removes saved product preferences. No product match request sends a photograph or scan to another model/service. Product images load from official CDN URLs with referrers disabled.

After applying migrations, run `node scripts/import-product-catalog.mjs` with the existing ignored server environment. The import validates basic record integrity, upserts stable facts and source records, updates ingredient mappings, publishes the verified snapshot and retires removed records within those curated brands without deleting experiment history. It is a complete snapshot for included brands; do not feed it a partial replacement. Never refresh verification timestamps without rechecking source facts. Reverify stock, exact variant price, ingredient list and manufacturer claims before publishing an update; add new brands with the same source standard. Records older than 30 days are automatically excluded. There is no hidden paid service or automatic claim-generating pipeline.

Verification: `npm run typecheck`, `npm test`, `npm run build`, and (with the local server running) `node scripts/verify-products.mjs`. The latter creates no-email temporary QA users and numerical test fixtures, checks private preferences/catalog grants/canonical tracking/usage/follow-up data/owner isolation, and deletes only those exact QA users with cascading fixtures. It makes no YouCam or LLM calls. Desktop/mobile browser verification covers filtering, product details, tracking prefill, experiment creation and usage logging.

When a selected concern set has zero eligible targeted matches, the page automatically shows separately labelled basic-care alternatives if any pass the same preferences and discovery filters. Selected concerns remain visible. These alternatives have no matched concern IDs and make no corrective claim for the selected structural concerns. If no basic-care products qualify either, the honest empty state remains.
