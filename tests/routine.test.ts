import { describe, it, expect } from "vitest";
import {
  buildSmartRoutine,
  checkIngredientCompatibility,
} from "../lib/products/routine";
import { defaultPreferences, type Product } from "../lib/products/types";
import catalog from "../data/products.catalog.json";

const now = Date.parse("2026-10-16T18:00:00Z");

describe("deterministic ingredient compatibility & smart routine builder", () => {
  it("flags retinoid + exfoliating acid as potential irritation risk and suggests alternating nights", () => {
    const res = checkIngredientCompatibility(["retinol", "glycolic_acid"]);
    expect(res.overall).toBe("irritation_risk");
    expect(res.interactions).toHaveLength(1);
    expect(res.interactions[0].timing).toBe("alternate_nights");
    expect(res.interactions[0].summary).toContain("Potential irritation risk");
    expect(res.interactions[0].guidance).toContain("not universally incompatible");
  });

  it("flags Vitamin C + Retinoid caution and suggests AM/PM separation", () => {
    const res = checkIngredientCompatibility(["vitamin_c", "retinal"]);
    expect(res.overall).toBe("caution");
    expect(res.interactions[0].timing).toBe("separate_am_pm");
  });

  it("identifies supportive barrier synergies with actives", () => {
    const res = checkIngredientCompatibility(["retinol", "ceramides", "panthenol"]);
    expect(res.overall).toBe("synergy");
    expect(res.interactions.some((i) => i.status === "synergy")).toBe(true);
  });

  it("builds a complete AM/PM routine from the verified catalog without any LLM", () => {
    const routine = buildSmartRoutine(
      catalog as Product[],
      { ...defaultPreferences, skin_type: "dry" },
      ["moisture", "radiance"],
      now,
    );
    expect(routine.am.length).toBeGreaterThanOrEqual(3);
    expect(routine.pm.length).toBeGreaterThanOrEqual(2);
    expect(routine.am.find((s) => s.role === "sunscreen")?.match).not.toBeNull();
    expect(routine.am.find((s) => s.role === "moisturizer")?.match).not.toBeNull();
    expect(routine.uniqueProductsInr).toBeGreaterThan(0);
  });

  it("keeps retinoids out of AM steps and avoids stacking exfoliating cleansers with PM retinoids", () => {
    const routine = buildSmartRoutine(
      catalog as Product[],
      {
        ...defaultPreferences,
        adult_confirmed: true,
        avoid_retinoids: false,
        skin_type: "normal",
      },
      ["wrinkle", "pore"],
      now,
    );
    for (const step of routine.am) {
      if (step.match) {
        expect(step.match.product.ingredient_ids).not.toContain("retinol");
        expect(step.match.product.ingredient_ids).not.toContain("retinal");
      }
    }
    const pmTreatment = routine.pm.find((s) => s.role === "treatment")?.match;
    const pmCleanser = routine.pm.find((s) => s.role === "cleanser")?.match;
    if (
      pmTreatment &&
      pmTreatment.product.ingredient_ids.some((id) =>
        ["retinol", "retinal", "hpr"].includes(id),
      ) &&
      pmCleanser
    ) {
      expect(pmCleanser.product.ingredient_ids).not.toContain("salicylic_acid");
      expect(pmCleanser.product.ingredient_ids).not.toContain("glycolic_acid");
    }
  });
});
