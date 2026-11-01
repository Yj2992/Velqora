import { z } from "zod";
import ingredients from "../../data/ingredients.catalog.json";
import { concernRules } from "./rules";
import { categories, skinTypes, preferencesSchema, type Preferences, type Product } from "./types";
const ingredientIds = ingredients.map(i => i.id) as [string, ...string[]];
const concernIds = concernRules.map(r => r.id) as [string, ...string[]];
// A model can propose search constraints, never products, clinical judgments or age consent.
export const productIntentSchema = z.object({
  skin_type: z.enum(skinTypes).nullable(),
  budget_inr: z.number().finite().min(50).max(100000).nullable(),
  categories: z.array(z.enum(categories)).max(6),
  concerns: z.array(z.enum(concernIds)).max(15),
  ingredient_ids: z.array(z.enum(ingredientIds)).max(10),
  avoid_ingredients: z.array(z.string().trim().min(2).max(100)).max(20),
  brand_names: z.array(z.string().trim().min(1).max(80)).max(10),
  fragrance_free: z.boolean(),
  non_comedogenic: z.boolean(),
  vegan: z.boolean(),
  sensitive: z.boolean(),
  unresolved_terms: z.array(z.string().trim().min(1).max(150)).max(6),
}).strict();
export type ProductIntent = z.infer<typeof productIntentSchema>;
export function mergeSearchPreferences(current: Preferences, intent: ProductIntent): Preferences {
  if (intent.unresolved_terms.length) throw new Error("Resolve unsupported requirements before applying filters.");
  return preferencesSchema.parse({
    ...current,
    // Existing stricter choices cannot be weakened by a model request.
    skin_type: current.skin_type === "unknown" && intent.skin_type ? intent.skin_type : current.skin_type,
    budget_inr: intent.budget_inr === null ? current.budget_inr : current.budget_inr === null ? intent.budget_inr : Math.min(current.budget_inr, intent.budget_inr),
    avoid_ingredients: [...new Set([...current.avoid_ingredients, ...intent.avoid_ingredients])],
    fragrance_free: current.fragrance_free || intent.fragrance_free,
    non_comedogenic: current.non_comedogenic || intent.non_comedogenic,
    vegan: current.vegan || intent.vegan,
    sensitive: current.sensitive || intent.sensitive || intent.skin_type === "sensitive",
  });
}
export function matchesSearchIntent(product: Product, intent: ProductIntent | null): boolean {
  if (!intent) return true;
  if (intent.unresolved_terms.length) return false;
  return (!intent.categories.length || intent.categories.includes(product.category)) &&
    (!intent.brand_names.length || intent.brand_names.some(b => b.toLowerCase() === product.brand.toLowerCase())) &&
    intent.ingredient_ids.every(id => product.ingredient_ids.includes(id));
}
export function describeIntent(intent: ProductIntent): string[] {
  return [
    ...(intent.skin_type ? [`${intent.skin_type} skin`] : []),
    ...(intent.budget_inr !== null ? [`Up to ₹${intent.budget_inr} per product`] : []),
    ...intent.categories.map(c => c.replaceAll("_", " ")),
    ...intent.concerns.map(id => concernRules.find(r => r.id === id)?.label || id),
    ...intent.ingredient_ids.map(id => `With ${ingredients.find(i => i.id === id)?.name || id}`),
    ...intent.avoid_ingredients.map(i => `Avoid ${i}`),
    ...intent.brand_names,
    ...(intent.fragrance_free ? ["Brand states fragrance-free"] : []),
    ...(intent.non_comedogenic ? ["Brand states non-comedogenic"] : []),
    ...(intent.vegan ? ["Brand states vegan"] : []),
    ...(intent.sensitive ? ["Conservative sensitive filter"] : []),
  ];
}
