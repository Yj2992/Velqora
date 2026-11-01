import type { actions } from "../types";
export const ruleVersion = "catalog-rules-2026-10-v1";
export const scoreInterpretation = {
  source: "https://docs.perfectcorp.com/reference/ai_skin_analysis",
  supportingSource:
    "https://www.perfectcorp.com/business/blog/ai-skincare/skin-analysis-api-claude-mcp-integration",
  verifiedAt: "2026-10-16",
  supportedProvider: "youcam-v2.1-sd",
  note: "YouCam describes higher values as more favorable and UI scores as presentation-adjusted. Relative ordering is not a validated severity scale. No diagnostic cutoffs are used.",
};
const evidence = {
  radiance:
    "https://www.aad.org/public/everyday-care/skin-care-basics/care/skin-care-in-your-20s",
  hydration:
    "https://www.aad.org/public/everyday-care/skin-care-basics/dry/pick-moisturizer",
  acne: "https://www.aad.org/public/diseases/acne/derm-treat/treat",
  pores:
    "https://www.aad.org/public/everyday-care/skin-care-secrets/face/treat-large-pores",
  retinol:
    "https://www.aad.org/public/everyday-care/skin-care-secrets/anti-aging/retinoid-retinol",
  pigment:
    "https://www.aad.org/public/everyday-care/skin-care-secrets/routine/fade-dark-spots",
  firm: "https://www.aad.org/public/cosmetic/younger-looking/firm-sagging-skin",
  eye: "https://www.mayoclinic.org/diseases-conditions/bags-under-eyes/symptoms-causes/syc-20369927",
  circles:
    "https://www.mayoclinic.org/symptoms/dark-circles-under-eyes/basics/causes/sym-20050624",
  niacinamide: "https://pubmed.ncbi.nlm.nih.gov/16766489/",
};
export type ConcernId = Exclude<(typeof actions)[number], "skin_type">;
export type ConcernRule = {
  id: ConcernId;
  label: string;
  ingredients: string[];
  categories: string[];
  support: "cosmetic" | "limited" | "not_topical";
  explanation: string;
  limitation: string;
  source: string;
};
export const concernRules: ConcernRule[] = [
  {
    id: "acne",
    label: "Acne appearance",
    ingredients: ["salicylic_acid"],
    categories: ["cleanser", "serum"],
    support: "cosmetic",
    explanation: "Salicylic acid can help unclog pores in acne-prone skin.",
    limitation:
      "A photo score does not diagnose acne. Painful, persistent or scarring breakouts need professional assessment.",
    source: evidence.acne,
  },
  {
    id: "redness",
    label: "Redness / comfort",
    ingredients: [
      "glycerin",
      "ceramides",
      "hyaluronic_acid",
      "panthenol",
      "oat",
    ],
    categories: ["moisturizer", "cleanser"],
    support: "limited",
    explanation:
      "Gentle moisturizing care can support dry or irritated-feeling skin.",
    limitation:
      "Redness has many causes. These are comfort/barrier matches, not rosacea or allergy treatments; persistent redness needs assessment.",
    source: evidence.hydration,
  },
  {
    id: "age_spot",
    label: "Dark-spot appearance",
    ingredients: [
      "uv_filters",
      "zinc_oxide",
      "vitamin_c",
      "azelaic_acid",
      "kojic_acid",
      "glycolic_acid",
      "retinol",
      "retinal",
    ],
    categories: ["serum", "moisturizer", "sunscreen"],
    support: "cosmetic",
    explanation:
      "Some topical ingredients can help the appearance of uneven pigmentation; sun protection matters.",
    limitation:
      "Changing or unusual spots should be assessed rather than self-treated. This is not a skin-lightening or diagnosis service.",
    source: evidence.pigment,
  },
  {
    id: "radiance",
    label: "Radiance",
    ingredients: ["vitamin_c", "glycerin", "hyaluronic_acid"],
    categories: ["serum", "moisturizer"],
    support: "cosmetic",
    explanation:
      "Hydration and vitamin C products may support a less dull appearance.",
    limitation:
      "Radiance is a cosmetic appearance measure affected by lighting; ingredient presence does not establish product efficacy.",
    source: evidence.radiance,
  },
  {
    id: "moisture",
    label: "Hydration",
    ingredients: [
      "glycerin",
      "hyaluronic_acid",
      "ceramides",
      "squalane",
      "panthenol",
      "urea",
    ],
    categories: ["moisturizer", "serum", "toner"],
    support: "cosmetic",
    explanation:
      "Humectants and emollients can support hydration and moisture retention.",
    limitation:
      "A scan cannot measure your barrier health or diagnose eczema. Stinging or cracked skin needs individual advice.",
    source: evidence.hydration,
  },
  {
    id: "oiliness",
    label: "Oiliness",
    ingredients: ["niacinamide", "salicylic_acid"],
    categories: ["serum", "cleanser", "moisturizer"],
    support: "limited",
    explanation:
      "Niacinamide formulations and pore-cleansing products may suit a stated oiliness concern.",
    limitation:
      "Evidence is formulation-specific; this engine cannot predict how a particular product will affect sebum.",
    source: evidence.niacinamide,
  },
  {
    id: "pore",
    label: "Pore appearance",
    ingredients: ["salicylic_acid", "retinol", "retinal"],
    categories: ["cleanser", "serum", "moisturizer"],
    support: "cosmetic",
    explanation:
      "Unclogging pores and appropriate retinoid care may make pores less noticeable.",
    limitation:
      "Products do not permanently close or erase pores. Irritation can make their appearance worse.",
    source: evidence.pores,
  },
  {
    id: "texture",
    label: "Texture",
    ingredients: [
      "glycerin",
      "hyaluronic_acid",
      "retinol",
      "retinal",
      "glycolic_acid",
      "lactic_acid",
    ],
    categories: ["moisturizer", "serum", "toner"],
    support: "cosmetic",
    explanation:
      "Hydration and appropriately chosen resurfacing ingredients may support smoother-looking skin.",
    limitation:
      "Exfoliation and retinoids can irritate. This is not a recommendation to layer multiple actives.",
    source: evidence.retinol,
  },
  {
    id: "firmness",
    label: "Firmness appearance",
    ingredients: ["glycerin", "hyaluronic_acid", "retinol", "retinal"],
    categories: ["moisturizer", "serum"],
    support: "limited",
    explanation:
      "Moisturizing care can temporarily soften the appearance of fine lines; some retinoids offer modest cosmetic effects.",
    limitation:
      "Creams cannot lift sagging skin. Matches here concern surface appearance, not structural tightening.",
    source: evidence.firm,
  },
  {
    id: "dark_circle_v2",
    label: "Dark-circle appearance",
    ingredients: ["glycerin", "hyaluronic_acid"],
    categories: ["eye_care"],
    support: "limited",
    explanation:
      "Eye-area moisturizers may support dryness-related appearance and comfort.",
    limitation:
      "Dark circles can reflect anatomy, pigmentation, allergies or other factors. Hydration cannot reliably remove them, and scan scores do not identify their cause.",
    source: evidence.circles,
  },
  {
    id: "eye_bag",
    label: "Eye bags",
    ingredients: [],
    categories: [],
    support: "not_topical",
    explanation: "No targeted product match is made for structural eye bags.",
    limitation:
      "Creams do not reliably correct fat protrusion or loose supporting tissue. Cool compresses may help temporary puffiness; persistent or symptomatic swelling needs assessment.",
    source: evidence.eye,
  },
  {
    id: "tear_trough",
    label: "Tear troughs",
    ingredients: [],
    categories: [],
    support: "not_topical",
    explanation:
      "No topical correction is recommended for tear-trough hollowing.",
    limitation:
      "Hydration cannot fill an anatomical hollow. Seek qualified advice if the appearance is a concern.",
    source: evidence.eye,
  },
  {
    id: "droopy_upper_eyelid",
    label: "Upper eyelids",
    ingredients: [],
    categories: [],
    support: "not_topical",
    explanation: "No product is presented as lifting a drooping upper eyelid.",
    limitation:
      "Topical skincare cannot reliably correct eyelid position. New, one-sided or vision-affecting drooping needs medical evaluation.",
    source: evidence.firm,
  },
  {
    id: "droopy_lower_eyelid",
    label: "Lower eyelids",
    ingredients: [],
    categories: [],
    support: "not_topical",
    explanation:
      "No product is presented as repositioning a drooping lower eyelid.",
    limitation:
      "Do not apply facial exfoliants or retinoids to eyelids based on a score. Position/structural concerns need qualified assessment.",
    source: evidence.firm,
  },
  {
    id: "wrinkle",
    label: "Fine-line appearance",
    ingredients: [
      "retinol",
      "retinal",
      "glycerin",
      "hyaluronic_acid",
      "vitamin_c",
    ],
    categories: ["moisturizer", "serum"],
    support: "cosmetic",
    explanation:
      "Moisturizing care and selected retinoid formulations may soften the appearance of fine lines.",
    limitation:
      "Results are modest and formulation-dependent. These products cannot remove deep folds or replace sun protection.",
    source: evidence.retinol,
  },
];
export const retinoids = ["retinol", "retinal", "hpr"];
export const exfoliants = [
  "salicylic_acid",
  "glycolic_acid",
  "lactic_acid",
  "pha",
];
