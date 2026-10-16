/** Idempotent curated-data import. Never scrapes or invents missing facts. */
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import {
  concernRules,
  scoreInterpretation,
  ruleVersion,
} from "../lib/products/rules.ts";
process.loadEnvFile(new URL("../.env.local", import.meta.url));
const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);
const products = JSON.parse(
  await readFile(
    new URL("../data/products.catalog.json", import.meta.url),
    "utf8",
  ),
);
const ingredients = JSON.parse(
  await readFile(
    new URL("../data/ingredients.catalog.json", import.meta.url),
    "utf8",
  ),
);
const uuid = (s) => {
  const h = createHash("sha256")
    .update("dermalens-catalog:" + s)
    .digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
};
const assert = (ok, msg) => {
  if (!ok) throw Error(msg);
};
assert(products.length >= 100, "At least 100 curated records required");
assert(
  new Set(products.map((p) => p.id)).size === products.length,
  "Duplicate product IDs",
);
assert(
  new Set(products.map((p) => p.official_url)).size === products.length,
  "Duplicate product URLs",
);
for (const p of products) {
  assert(
    p.available &&
      p.price_inr >= 50 &&
      p.image_url?.startsWith("https://") &&
      p.source_sha256.match(/^[a-f0-9]{64}$/),
    "Invalid catalog facts: " + p.name,
  );
  assert(
    new URL(p.source_url).origin === new URL(p.official_url).origin,
    "Unrelated source",
  );
  assert(
    p.ingredient_ids.length &&
      p.ingredient_ids.every((id) => ingredients.some((i) => i.id === id)),
    "Unknown ingredients",
  );
  assert(
    !p.inci_complete || p.inci_text?.length > 50,
    "Missing published INCI",
  );
}
const brands = [
  ...new Map(
    products.map((p) => [
      p.brand_slug,
      {
        id: uuid(p.brand_slug),
        slug: p.brand_slug,
        name: p.brand,
        official_url: new URL(p.official_url).origin,
      },
    ]),
  ).values(),
];
const sources = [],
  productSources = [],
  productIngredients = [],
  prices = [];
for (const p of products) {
  const priceId = uuid(p.id + ":price:" + p.verified_at),
    ingredientId = uuid(p.id + ":ingredients:" + p.verified_at);
  sources.push(
    {
      id: priceId,
      url: p.source_url,
      kind: "official_store_feed",
      verified_at: p.verified_at,
      content_sha256: p.source_sha256,
      hash_scope: "canonical_product_record",
      notes:
        "SHA-256 of captured product JSON serialized with sorted keys by the curation script; price applies to the named available variant.",
    },
    {
      id: ingredientId,
      url: p.ingredient_source_url,
      kind: p.inci_complete ? "official_product_page" : "official_store_feed",
      verified_at: p.verified_at,
      content_sha256: p.inci_complete ? null : p.source_sha256,
      hash_scope: p.inci_complete
        ? "published_ingredient_block"
        : "canonical_product_record",
      notes: p.inci_complete
        ? "Ingredient-only published INCI block captured; product title may supply an explicitly named active."
        : "Only manufacturer-named key ingredients captured. Full INCI and unlisted suitability remain unknown.",
    },
  );
  productSources.push(
    {
      product_id: p.id,
      source_id: priceId,
      verified_fields: [
        "name",
        "price",
        "pack_size",
        "availability",
        "image",
        "manufacturer_suitability",
      ],
    },
    {
      product_id: p.id,
      source_id: ingredientId,
      verified_fields: ["ingredients"],
    },
  );
  for (const id of p.ingredient_ids)
    productIngredients.push({
      product_id: p.id,
      ingredient_id: id,
      source_id: ingredientId,
      basis: p.inci_complete
        ? "published_inci_or_title"
        : "manufacturer_named_key_ingredients",
    });
  prices.push({
    id: uuid(p.id + ":variant:" + p.variant_id + ":" + p.verified_at),
    product_id: p.id,
    source_id: priceId,
    variant_id: p.variant_id,
    pack_size: p.pack_size,
    currency: "INR",
    amount: p.price_inr,
    mrp: p.mrp_inr,
    available: p.available,
    verified_at: p.verified_at,
  });
}
for (const url of [
  ...new Set(concernRules.map((r) => r.source)),
  scoreInterpretation.source,
  scoreInterpretation.supportingSource,
])
  sources.push({
    id: uuid(url),
    url,
    kind: url.includes("perfectcorp")
      ? "provider_documentation"
      : "clinical_guidance",
    verified_at: scoreInterpretation.verifiedAt + "T00:00:00Z",
    content_sha256: null,
    hash_scope: "reference_url",
    notes:
      "Human-reviewed supporting reference; not evidence of efficacy for any particular catalog product.",
  });
async function upsert(table, rows) {
  for (let i = 0; i < rows.length; i += 100) {
    const { error } = await db.from(table).upsert(rows.slice(i, i + 100));
    if (error) throw Error(table + ": " + error.message);
  }
  console.log(table, rows.length);
}
await upsert("catalog_brands", brands);
await upsert("catalog_sources", sources);
await upsert("catalog_ingredients", ingredients);
await upsert(
  "catalog_concerns",
  concernRules.map(({ source, ingredients, ...r }) => ({
    ...r,
    source_id: uuid(source),
    rule_version: ruleVersion,
  })),
);
const { error: clearMappings } = await db
  .from("catalog_concern_ingredients")
  .delete()
  .in(
    "concern_id",
    concernRules.map((r) => r.id),
  );
if (clearMappings) throw clearMappings;
await upsert(
  "catalog_concern_ingredients",
  concernRules.flatMap((r) =>
    r.ingredients.map((id) => ({ concern_id: r.id, ingredient_id: id })),
  ),
);
await upsert(
  "catalog_products",
  products.map((p) => ({
    id: p.id,
    brand_id: uuid(p.brand_slug),
    slug: p.slug,
    name: p.name,
    category: p.category,
    official_url: p.official_url,
    image_url: p.image_url,
    inci_text: p.inci_text,
    inci_complete: p.inci_complete,
    skin_types: p.skin_types,
    manufacturer_concerns: p.manufacturer_concerns,
    fragrance_free: p.fragrance_free,
    non_comedogenic: p.non_comedogenic,
    vegan: p.vegan,
    verification_notes: p.verification_notes,
    verified_at: p.verified_at,
    active: false,
  })),
);
// Replace ingredient joins so a later re-verification cannot leave removed ingredients behind.
const { error: removeError } = await db
  .from("catalog_product_ingredients")
  .delete()
  .in(
    "product_id",
    products.map((p) => p.id),
  );
if (removeError) throw removeError;
await upsert("catalog_product_ingredients", productIngredients);
await upsert("catalog_product_sources", productSources);
await upsert("catalog_prices", prices);
const { error } = await db
  .from("catalog_products")
  .update({ active: true })
  .in(
    "id",
    products.map((p) => p.id),
  );
if (error) throw error;
const { error: retireError } = await db
  .from("catalog_products")
  .update({ active: false })
  .in(
    "brand_id",
    brands.map((b) => b.id),
  )
  .not("id", "in", "(" + products.map((p) => p.id).join(",") + ")");
if (retireError) throw retireError;
console.log("Published", products.length, "verified catalog records.");
