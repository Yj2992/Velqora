import type { Scan } from "../types";
import { deterministicSummary } from "../progress";
import { concernRules } from "../products/rules";

// Reviewed reference material, not generated product or treatment recommendations.
export const skinReferences = [
  {
    title: "Everyday routine · AAD",
    url: "https://www.aad.org/public/everyday-care/skin-care-basics/care/skin-care-budget",
    text: "A simple routine can use a gentle cleanser, moisturizer and sun protection. Choose broad-spectrum SPF 30 or higher, alongside shade and protective clothing. Extra products are not automatically better.",
  },
  {
    title: "Acne care · AAD",
    url: "https://www.aad.org/public/diseases/acne/skin-care/tips",
    text: "For acne-prone skin, cleanse gently, avoid abrasive scrubbing and avoid picking spots. Painful, persistent or scarring breakouts need a dermatologist's assessment. A scan cannot diagnose acne or select a prescription.",
  },
  {
    title: "Moisturizer choices · AAD",
    url: "https://www.aad.org/public/everyday-care/skin-care-basics/dry/pick-moisturizer",
    text: "For dryness, a fragrance-free moisturizer and gentle cleansing are reasonable starting points. Creams or ointments can suit dry skin; adjust products to comfort and stop products that irritate. Persistent symptoms deserve professional assessment.",
  },
];

export function referenceGuidance(question: string, scans: Scan[]) {
  if (/\b(scan|score|trend|changed|measurement|experiment|progress)\b/i.test(question))
    return deterministicSummary(scans);
  const relevant = concernRules.filter((r) =>
    (r.label + " " + r.id).toLowerCase().split(/[\s_/]+/)
      .some((word) => word.length > 3 && question.toLowerCase().includes(word)),
  ).slice(0, 2);
  const basic = /acne|pimple|breakout/i.test(question) ? skinReferences[1]
    : /dry|hydrat|moistur|flak/i.test(question) ? skinReferences[2] : skinReferences[0];
  return [basic.text, ...relevant.map((r) => `${r.label}: ${r.explanation} ${r.limitation}`),
    ...(relevant.some((r) => r.ingredients.some((i) => i === "retinol" || i === "retinal")) ? ["Do not start retinoids on the basis of this guidance. Adult age and pregnancy/breastfeeding status must be checked; seek professional advice about suitability."] : []),
    "Use Find Products for verified catalog matches and Track This Product to record usage. This is general cosmetic guidance, not a diagnosis or a promise of improvement.",
  ].join("\n\n");
}
