import { recommend } from "./engine";
import { concernRules, type ConcernId } from "./rules";
import type { Preferences, Product } from "./types";
export function explainMatches(
  products: Product[],
  prefs: Preferences,
  focus: ConcernId[],
  now = Date.now(),
) {
  const rows = focus.map((id) => {
    const rule = concernRules.find((r) => r.id === id)!;
    const count = recommend(products, prefs, [id], now).length;
    const broaderCandidates =
      !count && rule.support !== "not_topical"
        ? recommend(
            products,
            { ...prefs, skin_type: "unknown", adult_confirmed: true },
            [id],
            now,
          ).length
        : 0;
    return {
      id,
      label: rule.label,
      count,
      message:
        rule.support === "not_topical"
          ? "Guidance only: topical correction is not supported."
          : count
            ? `${count} eligible products before search, brand and category filters.`
            : broaderCandidates
              ? "Ingredient matches exist, but none meet your current skin-type and active-ingredient preferences. Skin suitability is never assumed when the brand has not listed it."
              : "No verified ingredient/category matches meet your current preferences.",
    };
  });
  const eligibleIds = new Set(
    recommend(products, prefs, focus, now).map((m) => m.product.id),
  );
  const activeCandidates = !prefs.adult_confirmed
    ? recommend(
        products,
        { ...prefs, adult_confirmed: true },
        focus,
        now,
      ).filter((m) => !eligibleIds.has(m.product.id)).length
    : 0;
  const basicCare = recommend(products, prefs, [], now).length;
  return { rows, activeCandidates, basicCare };
}
