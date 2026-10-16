import { it, expect } from "vitest";
import { explainMatches } from "../lib/products/empty-state";
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
