import { it, expect } from "vitest";
import { discoverProducts, explainMatches } from "../lib/products/empty-state";
import { defaultPreferences, type Product } from "../lib/products/types";
import catalog from "../data/products.catalog.json";
const now = Date.parse("2026-10-16T18:00:00Z");
it("explains structural priorities without offering corrective creams", () => {
  const result = explainMatches(
    catalog as Product[],
    defaultPreferences,
    ["tear_trough"],
    now,
  );
  expect(result.rows[0].message).toContain("Guidance only");
  expect(result.activeCandidates).toBe(0);
  expect(result.basicCare).toBeGreaterThan(0);
});
it("identifies adult confirmation as a blocker without changing preferences", () => {
  const result = explainMatches(
    catalog as Product[],
    defaultPreferences,
    ["pore"],
    now,
  );
  expect(result.rows[0].count).toBe(0);
  expect(result.activeCandidates).toBeGreaterThan(0);
  expect(defaultPreferences.adult_confirmed).toBe(false);
});
it("keeps avoidance filters on basic care and diagnostic probes", () => {
  const result = explainMatches(
    catalog as Product[],
    { ...defaultPreferences, budget_inr: 50 },
    ["pore"],
    now,
  );
  expect(result.basicCare).toBe(0);
  expect(result.activeCandidates).toBe(0);
});

it("does not label already eligible products as age-blocked", () => {
  const item = {
    ...(catalog as Product[])[0],
    category: "moisturizer",
    ingredient_ids: ["glycerin"],
    name: "Plain moisturizer",
  } as Product;
  expect(
    explainMatches([item], defaultPreferences, ["moisture"], now)
      .activeCandidates,
  ).toBe(0);
});

it("automatically presents separate basic care for the reported dry-skin priorities", () => {
  const prefs = { ...defaultPreferences, skin_type: "dry" as const };
  const result = discoverProducts(
    catalog as Product[],
    prefs,
    ["tear_trough", "dark_circle_v2", "pore"],
    now,
  );
  expect(result.showingBasicCare).toBe(true);
  expect(result.matches.length).toBeGreaterThan(0);
  expect(
    result.matches.every(
      (m) =>
        m.matchedConcerns.length === 0 &&
        ["cleanser", "moisturizer", "sunscreen"].includes(m.product.category) &&
        m.product.skin_types.includes("dry"),
    ),
  ).toBe(true);
  expect(prefs.adult_confirmed).toBe(false);
  expect(prefs.avoid_retinoids).toBe(true);
});
it("does not bypass a budget or discovery filter to fill alternatives", () => {
  expect(
    discoverProducts(
      catalog as Product[],
      { ...defaultPreferences, budget_inr: 50 },
      ["tear_trough"],
      now,
    ).matches,
  ).toEqual([]);
  expect(
    discoverProducts(
      catalog as Product[],
      defaultPreferences,
      ["tear_trough"],
      now,
      false,
      () => false,
    ).matches,
  ).toEqual([]);
});
