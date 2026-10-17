import { it, expect } from "vitest";
import {
  starterShortlist,
  featuredIngredients,
} from "../lib/products/presentation";
import { recommend } from "../lib/products/engine";
import {
  defaultPreferences,
  type Product,
  type Match,
} from "../lib/products/types";
import catalog from "../data/products.catalog.json";
const eligible = recommend(
  catalog as Product[],
  { ...defaultPreferences, skin_type: "dry" },
  [],
  Date.parse("2026-10-17T00:00:00Z"),
);
it("balances a dry-skin shortlist across basic categories and available brands", () => {
  const list = starterShortlist(eligible);
  expect(list).toHaveLength(9);
  expect(new Set(list.map((m) => m.product.category)).size).toBe(3);
  expect(new Set(list.map((m) => m.product.brand_slug)).size).toBeGreaterThan(
    1,
  );
  expect(new Set(list.map((m) => m.product.id)).size).toBe(9);
  expect(
    list.every((m) => eligible.some((e) => e.product.id === m.product.id)),
  ).toBe(true);
  expect(list.every((m) => m.matchedConcerns.length === 0)).toBe(true);
});
it("does not change eligibility, original ranking, or product facts", () => {
  const before = JSON.stringify(eligible);
  expect(starterShortlist(eligible)).toEqual(starterShortlist(eligible));
  expect(JSON.stringify(eligible)).toBe(before);
  expect(starterShortlist([])).toEqual([]);
  expect(starterShortlist(eligible.slice(0, 2))).toHaveLength(2);
});
it("prioritizes ordinary moisturizer formats over cosmetic hybrids within a concern tier", () => {
  const base = eligible.find((m) => m.product.category === "moisturizer")!;
  const hybrid = {
    ...base,
    product: { ...base.product, id: "hybrid", name: "Strobe Highlighter" },
  };
  const plain = {
    ...base,
    product: { ...base.product, id: "plain", name: "Daily Moisturizer" },
  };
  expect(starterShortlist([hybrid, plain], 1)[0].product.id).toBe("plain");
});
it("puts matched ingredients first and only includes attributable catalog ingredients", () => {
  const m = {
    ...eligible[0],
    matchedIngredients: ["hyaluronic_acid"],
    product: {
      ...eligible[0].product,
      ingredient_ids: ["fragrance", "allantoin", "glycerin", "hyaluronic_acid"],
    },
  } as Match;
  expect(featuredIngredients(m)[0]).toBe("hyaluronic_acid");
  expect(featuredIngredients(m)).not.toContain("fragrance");
  expect(
    featuredIngredients(m).every((id) => m.product.ingredient_ids.includes(id)),
  ).toBe(true);
});
