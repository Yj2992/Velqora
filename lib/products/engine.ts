import type { Scan } from "../types";
import type { Match, Preferences, Product } from "./types";
import {
  concernRules,
  exfoliants,
  retinoids,
  scoreInterpretation,
  type ConcernId,
} from "./rules";
import ingredientCatalog from "../../data/ingredients.catalog.json";
const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]/g, "");
export function relativeFocus(
  scan: Scan | undefined,
): { id: ConcernId; score: number }[] {
  if (
    !scan ||
    scan.status !== "completed" ||
    scan.provider_version !== scoreInterpretation.supportedProvider
  )
    return [];
  return concernRules
    .flatMap((rule) => {
      const value = scan.skin_scan_metrics.find(
        (m) => m.metric_type === rule.id && m.region === "whole",
      )?.ui_score;
      return typeof value === "number" &&
        Number.isFinite(value) &&
        value >= 1 &&
        value <= 100 &&
        value < 100
        ? [{ id: rule.id, score: value }]
        : [];
    })
    .sort((a, b) => a.score - b.score || a.id.localeCompare(b.id))
    .slice(0, 3);
}
export function scanSkinType(scan: Scan | undefined): Preferences["skin_type"] {
  const whole = scan?.skin_type_results
    .find((t) => t.region.toLowerCase() === "whole")
    ?.skin_type.toLowerCase();
  return ["normal", "dry", "oily", "combination", "sensitive"].includes(
    whole || "",
  )
    ? (whole as Preferences["skin_type"])
    : "unknown";
}
export function recommend(
  products: Product[],
  preferences: Preferences,
  concerns: ConcernId[],
  now = Date.now(),
  browse = false,
): Match[] {
  const sensitive =
    preferences.sensitive || preferences.skin_type === "sensitive";
  const selected = concernRules.filter((r) => concerns.includes(r.id));
  const targets = selected.filter((r) => r.support !== "not_topical");
  // Structural-only concerns must not turn into a list of supposed corrective creams.
  if (selected.length && !targets.length) return [];
  return products
    .flatMap((product) => {
      const verified = Date.parse(product.verified_at);
      if (
        !product.available ||
        !Number.isFinite(product.price_inr) ||
        product.price_inr <= 0 ||
        !Number.isFinite(verified) ||
        verified > now + 86400000 ||
        now - verified > 30 * 86400000
      )
        return [];
      if (
        preferences.budget_inr !== null &&
        product.price_inr > preferences.budget_inr
      )
        return [];
      if (preferences.fragrance_free && product.fragrance_free !== true)
        return [];
      if (preferences.non_comedogenic && product.non_comedogenic !== true)
        return [];
      if (preferences.vegan && product.vegan !== true) return [];
      const hasRetinoid =
        retinoids.some((i) => product.ingredient_ids.includes(i)) ||
        /retin(?:ol|al|oid)/i.test(product.name);
      const hasExfoliant =
        exfoliants.some((i) => product.ingredient_ids.includes(i)) ||
        /\b(?:aha|bha|pha)\b|exfoliat/i.test(product.name);
      if (
        (preferences.avoid_retinoids ||
          !preferences.adult_confirmed ||
          sensitive) &&
        hasRetinoid
      )
        return [];
      if ((!preferences.adult_confirmed || sensitive) && hasExfoliant)
        return [];
      if (
        sensitive &&
        (!product.inci_complete || product.fragrance_free !== true)
      )
        return [];
      if (
        preferences.skin_type !== "unknown" &&
        (!product.skin_types.length ||
          !product.skin_types.includes(preferences.skin_type))
      )
        return [];
      if (preferences.avoid_ingredients.length) {
        if (!product.inci_complete || !product.inci_text) return [];
        const text = normalize(
          product.inci_text + " " + product.ingredient_ids.join(" "),
        );
        if (
          preferences.avoid_ingredients.some((avoid) => {
            const canonical = ingredientCatalog.find(
              (i) =>
                normalize(i.id) === normalize(avoid) ||
                new RegExp(i.aliases_pattern, "i").test(avoid),
            );
            return (
              text.includes(normalize(avoid)) ||
              Boolean(
                canonical &&
                  (product.ingredient_ids.includes(canonical.id) ||
                    new RegExp(canonical.aliases_pattern, "i").test(
                      product.inci_text!,
                    )),
              )
            );
          })
        )
          return [];
      }
      const matches = targets.filter(
        (rule) =>
          rule.categories.includes(product.category) &&
          rule.ingredients.some((i) => product.ingredient_ids.includes(i)),
      );
      const essentials =
        !selected.length &&
        (browse ||
          ["cleanser", "moisturizer", "sunscreen"].includes(product.category));
      if (!matches.length && !essentials) return [];
      const matchedIngredients = [
        ...new Set(
          matches.flatMap((r) =>
            r.ingredients.filter((i) => product.ingredient_ids.includes(i)),
          ),
        ),
      ];
      const reasons = matches.map(
        (r) =>
          `For your ${r.label.toLowerCase()} focus: the manufacturer lists ${r.ingredients
            .filter((i) => product.ingredient_ids.includes(i))
            .map((i) => i.replaceAll("_", " "))
            .join(", ")}. ${r.explanation}`,
      );
      if (essentials)
        reasons.push(
          browse
            ? "Catalog browse only; this is not a personalized efficacy recommendation."
            : "A basic-care category to browse; no concern or disease has been inferred.",
        );
      if (preferences.skin_type !== "unknown")
        reasons.push(
          `The manufacturer lists suitability for ${preferences.skin_type} skin.`,
        );
      if (preferences.budget_inr !== null)
        reasons.push(
          `The verified pack price is within your ₹${preferences.budget_inr} per-product budget.`,
        );
      const warnings = [...product.verification_notes];
      if (hasRetinoid)
        warnings.push(
          "Retinoids can irritate and should not be used during pregnancy or breastfeeding. Confirm suitability with a qualified clinician.",
        );
      if (hasExfoliant)
        warnings.push(
          "Contains an exfoliating ingredient. Do not start multiple exfoliants/retinoids together; follow the label and stop if irritation occurs.",
        );
      if (product.category === "sunscreen")
        warnings.push(
          "Check the pack for SPF, UVA coverage and reapplication directions. Skin type or Fitzpatrick category does not remove the need for sun protection.",
        );
      if (matches.some((r) => r.support === "limited"))
        warnings.push(
          "This is a limited cosmetic-support match, not reliable correction of the underlying concern.",
        );
      warnings.push(
        "Ingredient presence is not proof of this product’s efficacy. Check the received pack and patch-test before use.",
      );
      // Transparent merchandising weights, not clinical probabilities or severity thresholds.
      const rank =
        matches.length * 10 +
        matchedIngredients.length * 2 +
        (product.inci_complete ? 2 : 0) +
        (preferences.skin_type !== "unknown" ? 2 : 0) +
        (preferences.preferred_brands.includes(product.brand_slug) ? 1 : 0);
      return [
        {
          product,
          rank,
          reasons,
          warnings,
          matchedConcerns: matches.map((r) => r.id),
          matchedIngredients,
        },
      ];
    })
    .sort(
      (a, b) =>
        b.rank - a.rank ||
        a.product.price_inr - b.product.price_inr ||
        a.product.id.localeCompare(b.product.id),
    );
}
