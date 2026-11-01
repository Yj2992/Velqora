import { it, expect } from "vitest";
import { buildScanDiscoveryPlan, assessScanProducts } from "../lib/products/scan-discovery";
import { defaultPreferences } from "../lib/products/types";
import { scoreInterpretation } from "../lib/products/rules";
import type { Scan } from "../lib/types";
import type { WebProductResult } from "../lib/products/web-results";
// Synthetic fixture, not a person's stored scan.
export const scan:Scan={id:"private-scan-id",status:"completed",created_at:"2026-10-16",completed_at:"2026-10-16",overall_score:78.4,skin_age:36,provider_version:scoreInterpretation.supportedProvider,skin_type_results:[{region:"whole",skin_type:"Dry"}],skin_scan_metrics:[{metric_type:"tear_trough",region:"whole",ui_score:55,raw_score:null},{metric_type:"dark_circle_v2",region:"whole",ui_score:66,raw_score:null},{metric_type:"pore",region:"whole",ui_score:66,raw_score:null},{metric_type:"moisture",region:"whole",ui_score:72,raw_score:null}],image_storage_path:"secret-photo"};
const product:WebProductResult={title:"CeraVe Moisturising Cream",url:"https://www.ceraveindia.com/ceramides-skin-care/moisturisers/moisturising-cream",host:"www.ceraveindia.com",page_opened:true,price_quote:"₹499 for 50g",ingredients_quote:"Aqua, Glycerin, Ceramide NP, Sodium Hyaluronate",suitability_quote:"Suitable for dry and very dry skin."};
it("uses dry skin for hydration and keeps structural/lower eye scores as guidance",()=>{
 const p=buildScanDiscoveryPlan(scan,defaultPreferences);
 expect(p.skin_type).toBe("dry");expect(p.targets[0].id).toBe("moisture");expect(p.guidance.map(g=>g.label)).toContain("Tear troughs");expect(p.guidance.map(g=>g.label)).toContain("Dark-circle appearance");
 expect(p.targets.some(t=>["tear_trough","dark_circle_v2"].includes(t.id))).toBe(false);
 expect(p.search_brief).not.toContain("private-scan-id");expect(p.search_brief).not.toContain("secret-photo");expect(p.search_brief).not.toContain("36");expect(p.search_brief).not.toContain("78.4");expect(p.search_brief).not.toContain("55/100");
});
it("never interprets unverified provider scores",()=>{expect(()=>buildScanDiscoveryPlan({...scan,provider_version:"unknown-v3"},defaultPreferences)).toThrow("verified");});
it("does not use a high skin-age estimate as adult confirmation",()=>{const p=buildScanDiscoveryPlan({...scan,skin_age:70},defaultPreferences);expect(p.search_brief).toContain("adult age is not confirmed");expect(p.targets.flatMap(t=>t.ingredient_ids)).not.toContain("salicylic_acid");});
it("returns a source-supported moisturizer with reasons tied to the scan",()=>{
 const p=buildScanDiscoveryPlan(scan,defaultPreferences);const r=assessScanProducts([product],p,defaultPreferences);
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
