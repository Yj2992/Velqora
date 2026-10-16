import { z } from "zod";
export const skinTypes = [
  "normal",
  "dry",
  "oily",
  "combination",
  "sensitive",
] as const;
export const categories = [
  "cleanser",
  "moisturizer",
  "sunscreen",
  "serum",
  "toner",
  "eye_care",
] as const;
export const preferencesSchema = z.object({
  skin_type: z.enum([...skinTypes, "unknown"]).default("unknown"),
  budget_inr: z.number().finite().min(50).max(100000).nullable().default(null),
  avoid_ingredients: z
    .array(z.string().trim().min(2).max(100))
    .max(20)
    .default([]),
  preferred_brands: z
    .array(z.string().trim().min(1).max(80))
    .max(30)
    .default([]),
  fragrance_free: z.boolean().default(false),
  non_comedogenic: z.boolean().default(false),
  vegan: z.boolean().default(false),
  sensitive: z.boolean().default(false),
  avoid_retinoids: z.boolean().default(true),
  adult_confirmed: z.boolean().default(false),
});
export type Preferences = z.infer<typeof preferencesSchema>;
export const defaultPreferences = preferencesSchema.parse({});
export type Product = {
  id: string;
  slug: string;
  name: string;
  brand_slug: string;
  brand: string;
  category: (typeof categories)[number];
  official_url: string;
  image_url: string | null;
  ingredient_ids: string[];
  inci_text: string | null;
  inci_complete: boolean;
  skin_types: string[];
  manufacturer_concerns: string[];
  fragrance_free: boolean | null;
  non_comedogenic: boolean | null;
  vegan: boolean | null;
  price_inr: number;
  mrp_inr: number | null;
  pack_size: string;
  variant_id: string;
  available: boolean;
  verified_at: string;
  source_url: string;
  ingredient_source_url: string;
  source_sha256: string;
  verification_notes: string[];
};
export type Match = {
  product: Product;
  rank: number;
  reasons: string[];
  warnings: string[];
  matchedConcerns: string[];
  matchedIngredients: string[];
};
