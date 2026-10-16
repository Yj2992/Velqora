import "server-only";
import { adminClient } from "../supabase/server";
import { checked } from "../server/errors";
import type { Product } from "./types";
// Curated facts are public; scan data and private preferences never enter this query.
export async function getCatalog(): Promise<Product[]> {
  const db = adminClient();
  const products: Product[] = [];
  for (let offset = 0; ; offset += 500) {
    const rows = checked(
      await db
        .from("catalog_products")
        .select(
          "*,catalog_brands(name,slug),catalog_product_ingredients(ingredient_id),catalog_prices(*,catalog_sources(*)),catalog_product_sources(verified_fields,catalog_sources(*))",
        )
        .eq("active", true)
        .order("id")
        .range(offset, offset + 499),
    );
    for (const row of rows || []) {
      const price = [...row.catalog_prices].sort((a: any, b: any) =>
        b.verified_at.localeCompare(a.verified_at),
      )[0];
      if (!price) continue;
      const ingredientSource = [...row.catalog_product_sources]
        .filter((s: any) => s.verified_fields.includes("ingredients"))
        .sort((a: any, b: any) =>
          b.catalog_sources.verified_at.localeCompare(
            a.catalog_sources.verified_at,
          ),
        )[0];
      const verifiedAt = [
        row.verified_at,
        price.verified_at,
        ingredientSource?.catalog_sources.verified_at,
      ]
        .filter(Boolean)
        .map((date: string) => Date.parse(date));
      const factsVerifiedAt = new Date(Math.min(...verifiedAt)).toISOString();
      products.push({
        id: row.id,
        slug: row.slug,
        name: row.name,
        brand_slug: row.catalog_brands.slug,
        brand: row.catalog_brands.name,
        category: row.category,
        official_url: row.official_url,
        image_url: row.image_url,
        ingredient_ids: row.catalog_product_ingredients.map(
          (i: any) => i.ingredient_id,
        ),
        inci_text: row.inci_text,
        inci_complete: row.inci_complete,
        skin_types: row.skin_types,
        manufacturer_concerns: row.manufacturer_concerns,
        fragrance_free: row.fragrance_free,
        non_comedogenic: row.non_comedogenic,
        vegan: row.vegan,
        price_inr: Number(price.amount),
        mrp_inr: price.mrp === null ? null : Number(price.mrp),
        pack_size: price.pack_size,
        variant_id: price.variant_id,
        available: price.available,
        verified_at: factsVerifiedAt,
        source_url: price.catalog_sources.url,
        ingredient_source_url:
          ingredientSource?.catalog_sources.url || row.official_url,
        source_sha256: price.catalog_sources.content_sha256 || "",
        verification_notes: row.verification_notes,
      });
    }
    if (!rows || rows.length < 500) break;
  }
  return products;
}
