import { describe, it, expect } from "vitest";
import { recommend, relativeFocus, scanSkinType } from "../lib/products/engine";
import { defaultPreferences, type Product } from "../lib/products/types";
import { concernRules, scoreInterpretation } from "../lib/products/rules";
import { actions, type Scan } from "../lib/types";
import catalog from "../data/products.catalog.json";
import sourceRecords from "../data/product-source-records.json";
import { createHash } from "node:crypto";
const canonical = (v: any): string =>
  v === null || typeof v !== "object"
    ? JSON.stringify(v)
    : Array.isArray(v)
      ? "[" + v.map(canonical).join(", ") + "]"
      : "{" +
        Object.keys(v)
          .sort()
          .map((k) => JSON.stringify(k) + ": " + canonical(v[k]))
          .join(", ") +
        "}";
const now = Date.parse("2026-10-16T18:00:00Z");
const product = {
  ...(catalog as Product[])[0],
  name: "Test moisturizer",
  category: "moisturizer",
  ingredient_ids: ["glycerin"],
  inci_complete: true,
  inci_text:
    "Water, Glycerin, Panthenol, Sodium Hyaluronate, Ceramide NP, Squalane, Phenoxyethanol",
  skin_types: ["dry"],
  fragrance_free: true,
  available: true,
  price_inr: 300,
  verified_at: "2026-10-16T00:00:00Z",
} as Product;
const run = (
  patch: Partial<Product> = {},
  prefs = {},
  focus: any[] = ["moisture"],
) =>
  recommend(
    [{ ...product, ...patch }],
    { ...defaultPreferences, ...prefs },
    focus,
    now,
  );
const scan = (
  metrics: any[],
  provider = scoreInterpretation.supportedProvider,
) =>
  ({
    status: "completed",
    provider_version: provider,
    skin_scan_metrics: metrics,
    skin_type_results: [{ region: "whole", skin_type: "Dry" }],
  }) as Scan;
describe("source-backed product recommendations", () => {
  it("covers exactly all 15 provider indicators", () =>
    expect(concernRules.map((r) => r.id).sort()).toEqual(
      actions.filter((a) => a !== "skin_type").sort(),
    ));
  it("uses verified higher-favorable direction only for relative priorities", () => {
    const s = scan([
      { metric_type: "moisture", region: "whole", ui_score: 90 },
      { metric_type: "acne", region: "whole", ui_score: 60 },
      { metric_type: "pore", region: "whole", ui_score: 100 },
      { metric_type: "texture", region: "whole", ui_score: 0 },
    ]);
    expect(relativeFocus(s).map((r) => r.id)).toEqual(["acne", "moisture"]);
    expect(scanSkinType(s)).toBe("dry");
    expect(relativeFocus({ ...s, provider_version: "unknown" })).toEqual([]);
  });
  it("does not manufacture scores or reuse regional scores", () =>
    expect(
      relativeFocus(
        scan([
          { metric_type: "moisture", region: "left", ui_score: 10 },
          { metric_type: "acne", region: "whole", ui_score: null },
        ]),
      ),
    ).toEqual([]));
  it("matches ingredients and product category, with explanations", () => {
    expect(run()[0].matchedIngredients).toContain("glycerin");
    expect(run()[0].reasons.join(" ")).toContain("manufacturer");
    expect(run({ category: "cleanser" })).toHaveLength(0);
  });
  it("never markets topical correction for structural eye concerns", () => {
    for (const id of [
      "eye_bag",
      "tear_trough",
      "droopy_upper_eyelid",
      "droopy_lower_eyelid",
    ])
      expect(run({}, {}, [id])).toEqual([]);
  });
  it("keeps eye-area hydration matches in eye-care products", () => {
    expect(run({}, {}, ["dark_circle_v2"])).toEqual([]);
    expect(run({ category: "eye_care" }, {}, ["dark_circle_v2"])).toHaveLength(
      1,
    );
  });
  it("enforces budget and explicit skin suitability", () => {
    expect(run({}, { budget_inr: 299 })).toEqual([]);
    expect(run({}, { budget_inr: 300, skin_type: "dry" })).toHaveLength(1);
    expect(run({ skin_types: [] }, { skin_type: "dry" })).toEqual([]);
  });
  it("does not infer free-from, vegan or allergy safety from missing facts", () => {
    expect(run({ fragrance_free: null }, { fragrance_free: true })).toEqual([]);
    expect(run({ vegan: null }, { vegan: true })).toEqual([]);
    expect(
      run({ inci_complete: false }, { avoid_ingredients: ["fragrance"] }),
    ).toEqual([]);
    expect(run({ inci_complete: false }, { sensitive: true })).toEqual([]);
    expect(run({ inci_complete: false }, { skin_type: "sensitive" })).toEqual(
      [],
    );
  });
  it("matches canonical exclusion aliases including parfum and vitamin C", () => {
    expect(
      run(
        {
          inci_text: product.inci_text + ", Parfum",
          ingredient_ids: ["glycerin", "fragrance"],
        },
        { avoid_ingredients: ["fragrance"] },
      ),
    ).toEqual([]);
    expect(
      run(
        {
          inci_text: product.inci_text + ", Ascorbyl Glucoside",
          ingredient_ids: ["glycerin", "vitamin_c"],
        },
        { avoid_ingredients: ["vitamin C"] },
      ),
    ).toEqual([]);
    expect(run({}, { avoid_ingredients: ["niacinamide"] })).toHaveLength(1);
  });
  it("requires explicit adult opt-in for actives and excludes retinoids by default", () => {
    expect(run({ ingredient_ids: ["retinol", "glycerin"] })).toEqual([]);
    expect(
      run(
        { name: "Retinol serum", ingredient_ids: ["glycerin"] },
        { avoid_retinoids: false },
      ),
    ).toEqual([]);
    expect(
      run(
        { ingredient_ids: ["retinol", "glycerin"] },
        { avoid_retinoids: false, adult_confirmed: true },
      ),
    ).toHaveLength(1);
    expect(run({ ingredient_ids: ["salicylic_acid", "glycerin"] })).toEqual([]);
  });
  it("rejects unavailable, stale, future-dated and invalid-priced records", () => {
    expect(run({ available: false })).toEqual([]);
    expect(run({ verified_at: "2026-01-01" })).toEqual([]);
    expect(run({ verified_at: "2027-01-01" })).toEqual([]);
    expect(run({ price_inr: NaN })).toEqual([]);
  });
  it("browses essentials without inventing concerns", () => {
    expect(run({}, {}, [])[0].matchedConcerns).toEqual([]);
    expect(run({ category: "serum" }, {}, [])).toEqual([]);
  });
  it("ships 100 distinct available official Indian records with traceable facts", () => {
    expect(catalog).toHaveLength(100);
    expect(new Set(catalog.map((p) => p.id)).size).toBe(100);
    expect(new Set(catalog.map((p) => p.official_url)).size).toBe(100);
    for (const p of catalog) {
      const source = (sourceRecords as Record<string, any>)[p.id];
      expect(source.title).toBe(p.name);
      const variant = source.variants.find(
        (v: any) => String(v.id) === p.variant_id,
      );
      expect(Number(variant.price)).toBe(p.price_inr);
      expect(variant.available).toBe(true);
      expect(createHash("sha256").update(canonical(source)).digest("hex")).toBe(
        p.source_sha256,
      );
      expect(p.available).toBe(true);
      expect(p.price_inr).toBeGreaterThan(0);
      expect(p.ingredient_ids.length).toBeGreaterThan(0);
      expect(p.source_sha256).toMatch(/^[a-f0-9]{64}$/);
      expect(new URL(p.source_url).origin).toBe(new URL(p.official_url).origin);
      expect(p.image_url).toMatch(/^https:\/\//);
      if (p.inci_complete) expect(p.inci_text!.length).toBeGreaterThan(50);
    }
  });
});
