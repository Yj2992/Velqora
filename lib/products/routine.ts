import type { Match, Preferences, Product } from "./types";
import { concernRules, exfoliants, retinoids, type ConcernId } from "./rules";
import { recommend } from "./engine";
import ingredientCatalog from "../../data/ingredients.catalog.json";

export type CompatibilityStatus = "irritation_risk" | "caution" | "synergy" | "compatible";

export const compatibilityLabels: Record<CompatibilityStatus, string> = {
  irritation_risk: "Potential irritation risk",
  caution: "Layering caution",
  synergy: "Supportive pairing",
  compatible: "Generally compatible",
};

export type IngredientInteraction = {
  id: string;
  ingredientA: string;
  ingredientB: string;
  labelA: string;
  labelB: string;
  status: CompatibilityStatus;
  summary: string;
  guidance: string;
  timing: "separate_am_pm" | "alternate_nights" | "same_routine_ok" | "avoid_stacking";
  source: string;
};

export type RoutineSlotRole =
  | "cleanser"
  | "treatment"
  | "moisturizer"
  | "sunscreen";

export type RoutineStep = {
  step: number;
  timeOfDay: "AM" | "PM";
  role: RoutineSlotRole;
  title: string;
  match: Match | null;
  rationale: string;
  caution?: string;
};

export type SmartRoutinePlan = {
  am: RoutineStep[];
  pm: RoutineStep[];
  interactions: IngredientInteraction[];
  notes: string[];
  totalAmInr: number;
  totalPmInr: number;
  uniqueProductsInr: number;
};

const ingredientName = (id: string) =>
  ingredientCatalog.find((i) => i.id === id)?.name || id.replaceAll("_", " ");

const soothingBarrierIds = [
  "ceramides",
  "panthenol",
  "glycerin",
  "hyaluronic_acid",
  "squalane",
  "centella",
  "oat",
  "beta_glucan",
  "ectoin",
];

type InteractionRule = {
  id: string;
  groupA: string[];
  groupB: string[];
  allowSameId?: boolean;
  status: CompatibilityStatus;
  summary: string;
  guidance: string;
  timing: IngredientInteraction["timing"];
  source: string;
};

const interactionRules: InteractionRule[] = [
  {
    id: "retinoid-exfoliant",
    groupA: retinoids,
    groupB: exfoliants,
    status: "irritation_risk",
    summary:
      "Potential irritation risk when layered together, depending on formulation, concentration, and skin tolerance.",
    guidance:
      "Retinoids and exfoliating acids (AHA/BHA/PHA) are not universally incompatible, but layering separate products in the same evening can increase dryness or irritation. Many people prefer alternating nights, depending on formulation strength and individual tolerance.",
    timing: "alternate_nights",
    source: "https://www.aad.org/public/everyday-care/skin-care-secrets/anti-aging/retinoid-retinol",
  },
  {
    id: "double-retinoid",
    groupA: retinoids,
    groupB: retinoids,
    allowSameId: false,
    status: "irritation_risk",
    summary:
      "Potential irritation risk from overlapping multiple retinoid products.",
    guidance:
      "Layering separate retinoid products in the same routine rarely improves cosmetic outcomes and can increase peeling or sensitivity, depending on concentration and frequency.",
    timing: "avoid_stacking",
    source: "https://www.aad.org/public/everyday-care/skin-care-secrets/anti-aging/retinoid-retinol",
  },
  {
    id: "double-exfoliant",
    groupA: exfoliants,
    groupB: exfoliants,
    allowSameId: false,
    status: "caution",
    summary:
      "Potential over-exfoliation depending on concentration, pH, and frequency.",
    guidance:
      "While some single products are formulated with blended acids, layering multiple separate exfoliating products in one routine can increase stinging. Consider spacing them across separate days based on your skin's tolerance.",
    timing: "alternate_nights",
    source: "https://www.aad.org/public/everyday-care/skin-care-secrets/routine/safely-exfoliate-at-home",
  },
  {
    id: "retinoid-vitamin-c",
    groupA: retinoids,
    groupB: ["vitamin_c"],
    status: "caution",
    summary: "Best separated into morning and evening routines.",
    guidance:
      "To minimize potential irritation and pH overlap, apply Vitamin C in the morning (under sunscreen) and keep your retinoid for the evening routine.",
    timing: "separate_am_pm",
    source: "https://www.aad.org/public/everyday-care/skin-care-secrets/routine/fade-dark-spots",
  },
  {
    id: "exfoliant-vitamin-c",
    groupA: exfoliants,
    groupB: ["vitamin_c"],
    status: "caution",
    summary: "Layering acids with Vitamin C may cause stinging on reactive skin.",
    guidance:
      "Use Vitamin C in the morning and exfoliating acids in the evening (or on alternate days) to reduce potential flushing or tingling.",
    timing: "separate_am_pm",
    source: "https://www.aad.org/public/everyday-care/skin-care-secrets/routine/safely-exfoliate-at-home",
  },
  {
    id: "retinoid-barrier",
    groupA: retinoids,
    groupB: soothingBarrierIds,
    status: "synergy",
    summary: "Barrier humectants and lipids buffer retinoid dryness.",
    guidance:
      "Pairing a retinoid with ceramides, glycerin, hyaluronic acid, or panthenol helps support surface hydration and comfort during evening use.",
    timing: "same_routine_ok",
    source: "https://www.aad.org/public/everyday-care/skin-care-secrets/anti-aging/retinoid-retinol",
  },
  {
    id: "exfoliant-barrier",
    groupA: exfoliants,
    groupB: soothingBarrierIds,
    status: "synergy",
    summary: "Hydrating and soothing ingredients help offset acid dryness.",
    guidance:
      "Following an exfoliating cleanser or serum with a ceramide, panthenol, or glycerin moisturizer supports skin comfort.",
    timing: "same_routine_ok",
    source: "https://www.aad.org/public/everyday-care/skin-care-basics/dry/pick-moisturizer",
  },
  {
    id: "vitamin-c-sunscreen",
    groupA: ["vitamin_c"],
    groupB: ["uv_filters", "zinc_oxide"],
    status: "synergy",
    summary: "Complementary morning antioxidant + UV protection.",
    guidance:
      "Applying a Vitamin C product in the morning before broad-spectrum sunscreen supports daytime protection against UV-induced uneven pigmentation appearance.",
    timing: "same_routine_ok",
    source: "https://www.aad.org/public/everyday-care/skin-care-secrets/routine/fade-dark-spots",
  },
  {
    id: "niacinamide-actives",
    groupA: ["niacinamide"],
    groupB: [...retinoids, ...exfoliants],
    status: "synergy",
    summary: "Niacinamide pairs well with pore-care acids and retinoids.",
    guidance:
      "Niacinamide is water-soluble and well-tolerated alongside salicylic acid or retinoids, helping support barrier comfort.",
    timing: "same_routine_ok",
    source: "https://pubmed.ncbi.nlm.nih.gov/16766489/",
  },
];

/**
 * Deterministic ingredient compatibility checker.
 * Evaluates a set of canonical ingredient IDs without any LLM call.
 */
export function checkIngredientCompatibility(
  selectedIngredientIds: string[],
): {
  overall: CompatibilityStatus;
  interactions: IngredientInteraction[];
  summary: string;
} {
  const unique = [...new Set(selectedIngredientIds.filter(Boolean))];
  if (unique.length < 2) {
    return {
      overall: "compatible",
      interactions: [],
      summary:
        "Select at least two ingredients to check deterministic interaction and layering rules.",
    };
  }

  const interactions: IngredientInteraction[] = [];
  const seenPairs = new Set<string>();

  for (let i = 0; i < unique.length; i++) {
    for (let j = i + 1; j < unique.length; j++) {
      const a = unique[i];
      const b = unique[j];
      const pairKey = [a, b].sort().join("::");
      if (seenPairs.has(pairKey)) continue;

      for (const rule of interactionRules) {
        const forward = rule.groupA.includes(a) && rule.groupB.includes(b);
        const reverse = rule.groupA.includes(b) && rule.groupB.includes(a);
        if (!forward && !reverse) continue;
        if (a === b && !rule.allowSameId) continue;

        seenPairs.add(pairKey);
        interactions.push({
          id: `${rule.id}-${pairKey}`,
          ingredientA: forward ? a : b,
          ingredientB: forward ? b : a,
          labelA: ingredientName(forward ? a : b),
          labelB: ingredientName(forward ? b : a),
          status: rule.status,
          summary: rule.summary,
          guidance: rule.guidance,
          timing: rule.timing,
          source: rule.source,
        });
        break;
      }
    }
  }

  const order: Record<CompatibilityStatus, number> = {
    irritation_risk: 0,
    caution: 1,
    synergy: 2,
    compatible: 3,
  };
  interactions.sort((x, y) => order[x.status] - order[y.status]);

  const hasIrritationRisk = interactions.some(
    (x) => x.status === "irritation_risk",
  );
  const hasCaution = interactions.some((x) => x.status === "caution");
  const hasSynergy = interactions.some((x) => x.status === "synergy");

  const overall: CompatibilityStatus = hasIrritationRisk
    ? "irritation_risk"
    : hasCaution
      ? "caution"
      : hasSynergy
        ? "synergy"
        : "compatible";

  const summary = hasIrritationRisk
    ? "Potential irritation risk: these ingredients aren't universally incompatible, but layering separate products together can increase irritation depending on formulation, concentration, frequency, and individual tolerance. Consider alternating nights."
    : hasCaution
      ? "Layering caution: depending on formulation and skin sensitivity, separating morning and evening use (or alternating days) can help reduce potential stinging."
      : hasSynergy
        ? "Supportive pairing: these ingredient families generally complement each other well in a balanced routine, subject to individual product formulation."
        : "No specific layering concern flagged in our ingredient-level ruleset. Tolerance depends on full formulation, concentration, and frequency—always patch-test.";

  return { overall, interactions, summary };
}

const isRetinoidProduct = (p: Product) =>
  retinoids.some((id) => p.ingredient_ids.includes(id)) ||
  /retin(?:ol|al|oid)/i.test(p.name);

const isExfoliantProduct = (p: Product) =>
  exfoliants.some((id) => p.ingredient_ids.includes(id)) ||
  /\b(?:aha|bha|pha)\b|exfoliat|peel/i.test(p.name);

/**
 * Deterministic Smart Routine Builder.
 * Builds an AM and PM routine strictly from verified catalog records and safety rules,
 * preventing active-ingredient conflicts (e.g., never putting retinoids in AM or stacking
 * exfoliating acids with retinoids in the same PM routine).
 */
export function buildSmartRoutine(
  products: Product[],
  preferences: Preferences,
  concerns: ConcernId[],
  now = Date.now(),
): SmartRoutinePlan {
  // Get all eligible products under user safety/budget/ingredient preferences (browse=true so essentials are always eligible)
  const targetedMatches = recommend(products, preferences, concerns, now, false);
  const allEligibleMatches = recommend(products, preferences, [], now, true);

  // Merge so targeted matches retain their matchedConcerns and higher rank, while basic essentials fill missing categories
  const byId = new Map<string, Match>();
  for (const m of targetedMatches) byId.set(m.product.id, m);
  for (const m of allEligibleMatches) {
    if (!byId.has(m.product.id)) byId.set(m.product.id, m);
  }
  const pool = [...byId.values()].sort(
    (a, b) =>
      b.matchedConcerns.length - a.matchedConcerns.length ||
      b.rank - a.rank ||
      a.product.price_inr - b.product.price_inr,
  );

  const pickBest = (
    categoryList: Product["category"][],
    predicate: (m: Match) => boolean = () => true,
  ): Match | null => {
    const candidates = pool.filter(
      (m) =>
        categoryList.includes(m.product.category) &&
        !/highlighter|strobe|mist|stick|peel/i.test(m.product.name) &&
        predicate(m),
    );
    return candidates[0] || null;
  };

  // 1. AM Cleanser: Prefer gentle, non-retinoid cleanser (avoid strong AHA/BHA if PM has an active)
  const amCleanser =
    pickBest(
      ["cleanser"],
      (m) => !isRetinoidProduct(m.product) && !isExfoliantProduct(m.product),
    ) || pickBest(["cleanser"], (m) => !isRetinoidProduct(m.product));

  // 2. AM Treatment (Serum/Toner): Daytime-friendly (Vitamin C, Niacinamide, Hyaluronic Acid, Peptides, etc. — never Retinoids or AHAs)
  const amTreatment = pickBest(
    ["serum", "toner"],
    (m) =>
      !isRetinoidProduct(m.product) &&
      !isExfoliantProduct(m.product) &&
      (m.matchedConcerns.length > 0 ||
        m.product.ingredient_ids.some((id) =>
          [
            "vitamin_c",
            "niacinamide",
            "hyaluronic_acid",
            "panthenol",
            "ceramides",
            "peptides",
            "alpha_arbutin",
            "azelaic_acid",
          ].includes(id),
        )),
  );

  // 3. AM Moisturizer: Non-retinoid, non-exfoliant moisturizer
  const amMoisturizer = pickBest(
    ["moisturizer"],
    (m) => !isRetinoidProduct(m.product) && !isExfoliantProduct(m.product),
  );

  // 4. AM Sunscreen: Mandatory morning step
  const amSunscreen = pickBest(["sunscreen"]);

  // 5. PM Treatment: Can include targeted active (Retinoid OR Exfoliant if eligible, or barrier/hydrating serum)
  const pmTreatment =
    pickBest(
      ["serum", "toner"],
      (m) => m.matchedConcerns.length > 0 && m.product.id !== amTreatment?.product.id,
    ) ||
    pickBest(["serum", "toner"], (m) => m.matchedConcerns.length > 0) ||
    amTreatment;

  const pmHasLeaveOnActive =
    pmTreatment !== null &&
    (isRetinoidProduct(pmTreatment.product) ||
      isExfoliantProduct(pmTreatment.product));

  // 6. PM Cleanser: If PM treatment already has a retinoid or exfoliant, force a gentle non-exfoliating cleanser to prevent stacking
  const pmCleanser = pmHasLeaveOnActive
    ? pickBest(
        ["cleanser"],
        (m) => !isRetinoidProduct(m.product) && !isExfoliantProduct(m.product),
      ) || amCleanser
    : pickBest(["cleanser"], (m) => !isRetinoidProduct(m.product)) || amCleanser;

  // 7. PM Moisturizer: If PM treatment is a retinoid or exfoliant, ensure moisturizer is a soothing barrier moisturizer without conflicting actives
  const pmMoisturizer = pmHasLeaveOnActive
    ? pickBest(
        ["moisturizer"],
        (m) => !isRetinoidProduct(m.product) && !isExfoliantProduct(m.product),
      ) || amMoisturizer
    : amMoisturizer ||
      pickBest(["moisturizer"], (m) => !isRetinoidProduct(m.product));

  const describeStepReason = (
    match: Match | null,
    fallbackRole: string,
    isSunscreen = false,
  ) => {
    if (!match) {
      return `No catalog ${fallbackRole} matched all of your current filters (such as strict budget or full-INCI exclusions). Relax a filter to fill this step.`;
    }
    if (isSunscreen) {
      return `Broad-spectrum daytime UV protection (${match.product.ingredient_ids.map(ingredientName).slice(0, 3).join(", ") || "UV filters"}). Essential every morning, especially when using pigmentation or resurfacing care.`;
    }
    if (match.matchedConcerns.length > 0) {
      const labels = match.matchedConcerns
        .map((id) => concernRules.find((r) => r.id === id)?.label.toLowerCase())
        .filter(Boolean)
        .join(", ");
      const ing = match.matchedIngredients.map(ingredientName).join(", ");
      return `Targeted support for ${labels} featuring ${ing || "verified key ingredients"}.`;
    }
    const keyIng = match.product.ingredient_ids
      .slice(0, 3)
      .map(ingredientName)
      .join(", ");
    return `Everyday ${fallbackRole} foundation${keyIng ? ` with ${keyIng}` : ""} matching your skin-type and safety preferences.`;
  };

  const am: RoutineStep[] = [
    {
      step: 1,
      timeOfDay: "AM",
      role: "cleanser",
      title: "Morning Cleanse",
      match: amCleanser,
      rationale: describeStepReason(amCleanser, "cleanser"),
    },
    ...(amTreatment
      ? [
          {
            step: 2,
            timeOfDay: "AM" as const,
            role: "treatment" as const,
            title: "Daytime Antioxidant / Hydrating Serum",
            match: amTreatment,
            rationale: describeStepReason(amTreatment, "daytime serum"),
          },
        ]
      : []),
    {
      step: amTreatment ? 3 : 2,
      timeOfDay: "AM",
      role: "moisturizer",
      title: "Barrier Moisturizer",
      match: amMoisturizer,
      rationale: describeStepReason(amMoisturizer, "moisturizer"),
    },
    {
      step: amTreatment ? 4 : 3,
      timeOfDay: "AM",
      role: "sunscreen",
      title: "Broad-Spectrum Sun Protection",
      match: amSunscreen,
      rationale: describeStepReason(amSunscreen, "sunscreen", true),
    },
  ];

  const pmTreatmentCaution =
    pmTreatment && isRetinoidProduct(pmTreatment.product)
      ? "Evening preferred. Introduce gradually (2–3 nights/week); layering with separate exfoliating acids can increase irritation depending on formulation and tolerance. Do not use during pregnancy/breastfeeding."
      : pmTreatment && isExfoliantProduct(pmTreatment.product)
        ? "Introduce gradually (2–3 times per week) according to tolerance and follow with broad-spectrum sunscreen the next morning."
        : undefined;

  const pm: RoutineStep[] = [
    {
      step: 1,
      timeOfDay: "PM",
      role: "cleanser",
      title: "Evening Cleanse",
      match: pmCleanser,
      rationale: describeStepReason(pmCleanser, "cleanser"),
    },
    ...(pmTreatment
      ? [
          {
            step: 2,
            timeOfDay: "PM" as const,
            role: "treatment" as const,
            title:
              isRetinoidProduct(pmTreatment.product) ||
              isExfoliantProduct(pmTreatment.product)
                ? "Targeted Evening Treatment"
                : "Evening Replenishing Serum",
            match: pmTreatment,
            rationale: describeStepReason(pmTreatment, "evening treatment"),
            caution: pmTreatmentCaution,
          },
        ]
      : []),
    {
      step: pmTreatment ? 3 : 2,
      timeOfDay: "PM",
      role: "moisturizer",
      title: "Evening Barrier Recovery",
      match: pmMoisturizer,
      rationale: describeStepReason(pmMoisturizer, "moisturizer"),
    },
  ];

  // Collect all ingredients across the selected routine products to surface synergies and separation notes
  const routineIngredientIds = [
    ...new Set(
      [...am, ...pm]
        .flatMap((s) => s.match?.product.ingredient_ids || []),
    ),
  ];
  const compatibility = checkIngredientCompatibility(routineIngredientIds);

  const uniqueProducts = new Map<string, Product>();
  for (const s of [...am, ...pm]) {
    if (s.match) uniqueProducts.set(s.match.product.id, s.match.product);
  }

  const totalAmInr = am.reduce(
    (sum, s) => sum + (s.match?.product.price_inr || 0),
    0,
  );
  const totalPmInr = pm.reduce(
    (sum, s) => sum + (s.match?.product.price_inr || 0),
    0,
  );
  const uniqueProductsInr = [...uniqueProducts.values()].reduce(
    (sum, p) => sum + p.price_inr,
    0,
  );

  const notes: string[] = [
    "Built deterministically from verified catalog records and ingredient-level heuristics — tolerance depends on full formulation, concentration, frequency, and individual skin response.",
    "Introduce only one new product at a time and patch-test before combining active steps.",
  ];
  if (pmHasLeaveOnActive) {
    notes.push(
      "Conservative pacing applied: leave-on retinoids and exfoliating acids are placed in the PM slot and paired with a gentle cleanser and barrier moisturizer to reduce potential irritation.",
    );
  }

  return {
    am,
    pm,
    interactions: compatibility.interactions,
    notes,
    totalAmInr,
    totalPmInr,
    uniqueProductsInr,
  };
}
