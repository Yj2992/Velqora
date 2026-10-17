import type { Match } from "./types";
export const categoryNames: Record<string, string> = {
  cleanser: "Cleansers",
  moisturizer: "Moisturizers",
  sunscreen: "Sun protection",
  serum: "Serums",
  toner: "Toners",
  eye_care: "Eye care",
};
const order = [
  "cleanser",
  "moisturizer",
  "sunscreen",
  "serum",
  "toner",
  "eye_care",
];
// A merchandising shortlist, never an efficacy score or a prescribed routine.
export function starterShortlist(matches: Match[], limit = 9): Match[] {
  const buckets = order.map((category) =>
    matches
      .filter((m) => m.product.category === category)
      .map((match, index) => ({ match, index }))
      .sort(
        (a, b) =>
          b.match.matchedConcerns.length - a.match.matchedConcerns.length ||
          Number(/highlighter|strobe|mist|stick/i.test(a.match.product.name)) -
            Number(
              /highlighter|strobe|mist|stick/i.test(b.match.product.name),
            ) ||
          a.index - b.index,
      )
      .map((x) => x.match),
  );
  const selected: Match[] = [],
    ids = new Set<string>(),
    brands = new Map<string, number>();
  for (const cap of [2, Infinity]) {
    let added = true;
    while (added && selected.length < limit) {
      added = false;
      for (const bucket of buckets) {
        if (selected.length >= limit) break;
        const next = bucket.find(
          (m) =>
            !ids.has(m.product.id) &&
            (brands.get(m.product.brand_slug) || 0) < cap,
        );
        if (next) {
          selected.push(next);
          ids.add(next.product.id);
          brands.set(
            next.product.brand_slug,
            (brands.get(next.product.brand_slug) || 0) + 1,
          );
          added = true;
        }
      }
    }
  }
  return selected;
}
export function featuredIngredients(match: Match) {
  const preferred =
    match.product.category === "sunscreen"
      ? ["uv_filters", "zinc_oxide", "glycerin", "ceramides"]
      : ["ceramides", "glycerin", "hyaluronic_acid", "panthenol", "squalane"];
  return [
    ...new Set([
      ...match.matchedIngredients,
      ...preferred.filter((id) => match.product.ingredient_ids.includes(id)),
      ...match.product.ingredient_ids,
    ]),
  ]
    .filter((id) => !["fragrance", "alcohol_denat"].includes(id))
    .slice(0, 4);
}
