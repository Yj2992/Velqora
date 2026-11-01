import { it, expect } from "vitest";
import { buildScanDiscoveryPlan, assessScanProducts } from "../lib/products/scan-discovery";
import { defaultDiscoveryFilters } from "../lib/products/discovery-filters";
import { defaultPreferences } from "../lib/products/types";
import { scoreInterpretation } from "../lib/products/rules";
import type { Scan } from "../lib/types";
import type { WebProductResult } from "../lib/products/web-results";
// Synthetic fixture, not a person's stored scan.
export const scan:Scan={id:"private-scan-id",status:"completed",created_at:"2026-10-16",completed_at:"2026-10-16",overall_score:78.4,skin_age:36,provider_version:scoreInterpretation.supportedProvider,skin_type_results:[{region:"whole",skin_type:"Dry"}],skin_scan_metrics:[{metric_type:"tear_trough",region:"whole",ui_score:55,raw_score:null},{metric_type:"dark_circle_v2",region:"whole",ui_score:66,raw_score:null},{metric_type:"pore",region:"whole",ui_score:66,raw_score:null},{metric_type:"moisture",region:"whole",ui_score:72,raw_score:null}],image_storage_path:"secret-photo"};
const product:WebProductResult={title:"CeraVe Moisturising Cream",url:"https://www.ceraveindia.com/ceramides-skin-care/moisturisers/moisturising-cream",host:"www.ceraveindia.com",page_opened:true,price_quote:"₹499 for 50g",ingredients_quote:"Aqua, Glycerin, Ceramide NP, Sodium Hyaluronate",suitability_quote:"Suitable for dry and very dry skin."};
it("uses selected scan priorities without replacing them with unrelated hydration",()=>{
 const p=buildScanDiscoveryPlan(scan,defaultPreferences);
 expect(p.skin_type).toBe("dry");expect(p.targets.map(t=>t.id)).not.toContain("moisture");expect(p.guidance.map(g=>g.label)).toContain("Tear troughs");expect(p.guidance.map(g=>g.label)).toContain("Dark-circle appearance");
 expect(p.targets.some(t=>["tear_trough"].includes(t.id))).toBe(false);
 expect(p.search_brief).not.toContain("private-scan-id");expect(p.search_brief).not.toContain("secret-photo");expect(p.search_brief).not.toContain("36");expect(p.search_brief).not.toContain("78.4");expect(p.search_brief).not.toContain("55/100");
});
it("never interprets unverified provider scores",()=>{expect(()=>buildScanDiscoveryPlan({...scan,provider_version:"unknown-v3"},defaultPreferences)).toThrow("verified");});
it("does not use a high skin-age estimate as adult confirmation",()=>{const p=buildScanDiscoveryPlan({...scan,skin_age:70},defaultPreferences);expect(p.search_brief).toContain("Exclude retinoids");expect(p.targets.flatMap(t=>t.ingredient_ids)).not.toContain("salicylic_acid");});
it("returns a source-supported moisturizer with reasons tied to the scan",()=>{
 const filters={...defaultDiscoveryFilters,concerns:["moisture"]};const p=buildScanDiscoveryPlan(scan,defaultPreferences,filters);const r=assessScanProducts([product],p,defaultPreferences,filters);
 expect(r.matches).toHaveLength(1);expect(r.matches[0].matched_ingredients).toContain("glycerin");expect(r.matches[0].reasons.join(" ")).toContain("dry skin");expect(r.matches[0].category).toBe("moisturizer");
});
it("keeps missing suitability, unopen pages and collection pages out of personalized matches",()=>{
 const p=buildScanDiscoveryPlan(scan,defaultPreferences);
 for(const patch of [{suitability_quote:null},{page_opened:false},{url:"https://brand.com/collections/moisturizers"},{suitability_quote:"Not suitable for dry skin."}]){expect(assessScanProducts([{...product,...patch}],p,defaultPreferences).matches).toHaveLength(0);}
});
it("does not use incomplete ingredient excerpts to clear exclusions",()=>{
 const prefs={...defaultPreferences,avoid_ingredients:["fragrance"]};const r=assessScanProducts([product],buildScanDiscoveryPlan(scan,prefs),prefs);expect(r.matches).toHaveLength(0);expect(r.needs_review[0].review_reasons.join(" ")).toContain("complete ingredient list");
});
it("enforces stated price and manufacturer-claim preferences",()=>{
 const prefs={...defaultPreferences,budget_inr:400,fragrance_free:true,vegan:true};const r=assessScanProducts([product],buildScanDiscoveryPlan(scan,prefs),prefs);expect(r.matches).toHaveLength(0);expect(r.needs_review[0].review_reasons.join(" ")).toMatch(/budget/);expect(r.needs_review[0].review_reasons.join(" ")).toContain("vegan");
 const budget={...defaultPreferences,budget_inr:500};expect(assessScanProducts([{...product,price_quote:null}],buildScanDiscoveryPlan(scan,budget),budget).matches).toHaveLength(0);
});
it("blocks named exfoliating actives and retinoids without the required choices",()=>{
 const p=buildScanDiscoveryPlan(scan,defaultPreferences);
 for(const name of ["Retinol Moisturizer","Salicylic Acid Cleanser"]){expect(assessScanProducts([{...product,title:name}],p,defaultPreferences).matches).toHaveLength(0);}
});

it("honors manual concern, brand, category and full-list controls",()=>{
 const filters={...defaultDiscoveryFilters,concerns:["moisture"],brand:"CeraVe",category:"moisturizer" as const,full_ingredients_only:true};
 const plan=buildScanDiscoveryPlan(scan,defaultPreferences,filters);
 expect(plan.priorities.map(p=>p.id)).toEqual(["moisture"]);
 expect(plan.search_brief).toContain("Brand: CeraVe only");
 expect(assessScanProducts([product],plan,defaultPreferences,filters).matches).toHaveLength(0);
 const full={...product,full_inci_quote:"Ingredients: Aqua, Glycerin, Ceramide NP, Sodium Hyaluronate"};
 expect(assessScanProducts([full],plan,defaultPreferences,filters).matches).toHaveLength(1);
 expect(assessScanProducts([full],plan,defaultPreferences,{...filters,category:"serum"}).matches).toHaveLength(0);
 expect(assessScanProducts([full],plan,defaultPreferences,{...filters,brand:"Minimalist"}).matches).toHaveLength(0);
});
it("permits retinoid pore matches only after explicit adult confirmation and opt-in",()=>{
 const filters={...defaultDiscoveryFilters,concerns:["pore"]};
 const prefs={...defaultPreferences,adult_confirmed:true,avoid_retinoids:false};
 const retinol={...product,title:"Retinol Night Repair Cream",ingredients_quote:"Retinol, Glycerin, Ceramide NP"};
 const plan=buildScanDiscoveryPlan(scan,prefs,filters);
 const eligible=assessScanProducts([retinol],plan,prefs,filters).matches;
 expect(eligible).toHaveLength(1);expect(eligible[0].matched_concerns).toEqual(["pore"]);
 expect(eligible[0].limitations.join(" ")).toContain("pregnancy");
 for(const patch of [{adult_confirmed:false},{avoid_retinoids:true},{sensitive:true}]){
 const blocked={...prefs,...patch};expect(assessScanProducts([retinol],buildScanDiscoveryPlan(scan,blocked,filters),blocked,filters).matches).toHaveLength(0);
 }
});
it("keeps structural-only concerns guidance-only and sorts qualified prices",()=>{
 const structural={...defaultDiscoveryFilters,concerns:["tear_trough"]};
 expect(assessScanProducts([product],buildScanDiscoveryPlan(scan,defaultPreferences,structural),defaultPreferences,structural).matches).toHaveLength(0);
 const filters={...defaultDiscoveryFilters,concerns:["moisture"],sort:"price-low" as const};
 const results=[{...product,url:product.url+"?large",price_quote:"₹899"},{...product,url:product.url+"?small",price_quote:"₹299"},{...product,url:product.url+"?unknown",price_quote:null}];
 expect(assessScanProducts(results,buildScanDiscoveryPlan(scan,defaultPreferences,filters),defaultPreferences,filters).matches.map(p=>p.price_quote)).toEqual(["₹299","₹899",null]);
});
