import { z } from "zod";
import { categories } from "./types";
import { concernRules } from "./rules";
const ids=concernRules.map(r=>r.id) as [string,...string[]];
export const discoveryFiltersSchema=z.object({
  concerns:z.array(z.enum(ids)).max(15).nullable().default(null),
  brand:z.string().trim().max(80).default(""),
  category:z.enum(["",...categories]).default(""),
  query:z.string().trim().max(200).default(""),
  full_ingredients_only:z.boolean().default(false),
  sort:z.enum(["matches","price-low","price-high"]).default("matches"),
  list_view:z.enum(["shortlist","all"]).default("shortlist"),
}).strict();
export type DiscoveryFilters=z.infer<typeof discoveryFiltersSchema>;
export const defaultDiscoveryFilters=discoveryFiltersSchema.parse({});
export function quotedPrice(quote:string|null|undefined):number|null {
  const amounts=[...(quote||"").matchAll(/(?:₹|INR|Rs\.?)\s*([\d,]+(?:\.\d{1,2})?)/gi)].map(m=>Number(m[1].replaceAll(",",""))).filter(n=>Number.isFinite(n)&&n>0);
  return amounts.length?Math.max(...amounts):null;
}
export function sourceCategory(title:string) {
  if(/sunscreen|sun screen|\bSPF\b/i.test(title))return "sunscreen";
  if(/eye[ -]?(?:cream|serum|gel)|under[ -]?eye/i.test(title))return "eye_care";
  if(/cleanser|face\s*wash|cleansing|wash gel/i.test(title))return "cleanser";
  if(/\bserum\b/i.test(title))return "serum";
  if(/\btoner\b|tonic/i.test(title))return "toner";
  if(/moisturi[sz]|\bcream\b|\bbaume\b|\bbalm\b/i.test(title))return "moisturizer";
  return "unknown";
}
// Store domains are public source identities, not an expansion of the curated catalog.
const knownDomains:Record<string,string[]>={"minimalist":["beminimalist.co"],"deconstruct":["thedeconstruct.in"],"dot & key":["dotandkey.com"],"plum":["plumgoodness.com"],"re’equil":["reequil.com"]};
export function sourceBrandMatches(title:string,host:string,brand:string) {
  if(!brand)return true;
  const domains=knownDomains[brand.toLowerCase()]||[];
  if(domains.some(d=>host===d||host.endsWith("."+d)))return true;
  const escape=(s:string)=>s.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
  return new RegExp(`(?:^|[^a-z0-9])${escape(brand)}(?:$|[^a-z0-9])`,"i").test(title);
}

export const preferredBrandNames:Record<string,string>={minimalist:"Minimalist",deconstruct:"Deconstruct","dot-key":"Dot & Key","dot-and-key":"Dot & Key",plum:"Plum",reequil:"Re’equil"};
