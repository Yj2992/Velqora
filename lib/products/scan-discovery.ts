import type { Scan } from "../types";
import type { Preferences } from "./types";
import { scanSkinType, relativeFocus } from "./engine";
import { concernRules, retinoids, exfoliants, scoreInterpretation, type ConcernId } from "./rules";
import { defaultDiscoveryFilters, preferredBrandNames, quotedPrice, sourceCategory, sourceBrandMatches, type DiscoveryFilters } from "./discovery-filters";
import ingredients from "../../data/ingredients.catalog.json";
import type { WebProductResult, WebProductSearch } from "./web-results";
export type ScanDiscoveryPlan = {
  skin_type: Preferences["skin_type"];
  priorities: {id:ConcernId;label:string;score:number|null}[];
  targets: {id:ConcernId;label:string;reason:string;ingredient_ids:string[]}[];
  guidance: {label:string;text:string;source:string}[];
  search_brief: string;
};
export type ScanProductMatch = WebProductResult & {reasons:string[];limitations:string[];category:string;matched_ingredients:string[];matched_concerns:ConcernId[];rank:number};
export type ScanProductDiscovery = WebProductSearch & {scan_id:string;plan:ScanDiscoveryPlan;matches:ScanProductMatch[];needs_review:(WebProductResult & {review_reasons:string[]})[]};
export function buildScanDiscoveryPlan(scan:Scan,prefs:Preferences,filters:DiscoveryFilters=defaultDiscoveryFilters):ScanDiscoveryPlan {
  if(scan.status!=="completed" || scan.provider_version!==scoreInterpretation.supportedProvider)throw new Error("Automatic product discovery requires a completed scan with verified YouCam score interpretation.");
  const skin_type=prefs.skin_type === "unknown" ? scanSkinType(scan) : prefs.skin_type;
  const chosen=filters.concerns===null?relativeFocus(scan).map(p=>p.id):filters.concerns as ConcernId[];
  const priorities=concernRules.filter(r=>chosen.includes(r.id)).map(r=>{const score=scan.skin_scan_metrics.find(m=>m.metric_type===r.id&&m.region==="whole")?.ui_score;return {id:r.id,label:r.label,score:typeof score==="number"&&Number.isFinite(score)&&score>=1&&score<=100?score:null};});
  const allowRetinoids=prefs.adult_confirmed&&!prefs.avoid_retinoids&&!prefs.sensitive&&skin_type!=="sensitive";
  const allowExfoliants=prefs.adult_confirmed&&!prefs.sensitive&&skin_type!=="sensitive";
  const targets:ScanDiscoveryPlan["targets"]=[];
  // Empty concerns explicitly means basic care. Otherwise, selected chips are authoritative.
  if(!chosen.length&&(skin_type==="dry"||skin_type==="sensitive"))targets.push({id:"moisture",label:"Hydration & everyday barrier care",reason:`Your ${skin_type} skin type supports a gentle moisturizing starting point; no targeted concern is selected.`,ingredient_ids:["glycerin","ceramides","hyaluronic_acid","panthenol","squalane"]});
  for(const p of priorities){
    const r=concernRules.find(r=>r.id===p.id)!;
    if(r.support==="not_topical")continue;
    const ids=r.ingredients.filter(id=>(allowRetinoids||!retinoids.includes(id))&&(allowExfoliants||!exfoliants.includes(id)));
    if(ids.length)targets.push({id:r.id,label:r.label,reason:filters.concerns===null?`${r.label} is a lower relative score in this scan, not a severity grade.`:`You selected ${r.label.toLowerCase()}.`,ingredient_ids:ids});
  }
  const guidance=priorities.flatMap(p=>{const r=concernRules.find(r=>r.id===p.id)!;return r.support!=="cosmetic"||!targets.some(t=>t.id===r.id)?[{label:r.label,text:r.limitation,source:r.source}]:[];});
  const wanted=[...new Set(targets.flatMap(t=>t.ingredient_ids))].map(id=>ingredients.find(i=>i.id===id)?.name||id);
  const requestedCategories=filters.category?[filters.category]:[...new Set(targets.flatMap(t=>concernRules.find(r=>r.id===t.id)?.categories||[]))];
  const constraints=[prefs.preferred_brands.length?`Prefer these brands when otherwise eligible: ${prefs.preferred_brands.map(id=>preferredBrandNames[id]||id).join(", ")}; this is a ranking preference, not an exclusion.`:"",filters.brand?`Brand: ${filters.brand} only.`:"",filters.category?`Category: ${filters.category}.`:`Product categories: ${requestedCategories.join(", ")||"gentle cleanser, moisturizer or sunscreen"}.`,filters.query?`Product/ingredient search text: ${JSON.stringify(filters.query)}.`:"",filters.full_ingredients_only||prefs.avoid_ingredients.length?"Open pages with a published COMPLETE ingredient/INCI list, not just key ingredients. Capture the complete list including its heading.":"",prefs.budget_inr!==null?`Maximum INR ${prefs.budget_inr} per product; verify exact pack price.`:"",prefs.avoid_ingredients.length?`Avoid ingredients: ${prefs.avoid_ingredients.join(", ")}. Check the full formula; do not assume absence.`:"",prefs.fragrance_free?"Require an explicit fragrance-free claim.":"",prefs.non_comedogenic?"Require an explicit non-comedogenic claim.":"",prefs.vegan?"Require an explicit vegan claim.":"",allowRetinoids?"Retinoids may be considered because the user explicitly opted in and self-confirmed adult age. This does not establish pregnancy/breastfeeding suitability; no retinoids during pregnancy or breastfeeding.":"Exclude retinoids.",allowExfoliants?"Do not suggest layering multiple active products.":"Exclude exfoliating acids; adult/sensitive-skin suitability choices do not allow them."].filter(Boolean);
  const search_brief=`Find individual skincare product pages available in India for ${skin_type==="unknown"?"unspecified":skin_type} skin, based on these selected cosmetic concerns: ${priorities.map(p=>p.label).join(", ")||"none; basic care browsing"}. Seek ingredient support from ${wanted.join(", ")||"basic gentle care only"}. ${constraints.join(" ")} Never claim creams correct tear troughs, eye bags or eyelid position, or reliably remove dark circles. Honor the selected concern/category combinations; do not replace them with unrelated products. Prefer official Indian product pages, beyond a local catalog. Open up to three individual product pages for full ingredient lists and manufacturer skin-suitability statements.`;
  return {skin_type,priorities,targets,guidance,search_brief};
}
const has=(id:string,text:string)=>{const item=ingredients.find(i=>i.id===id);return item?new RegExp(item.aliases_pattern,"i").test(text):false;};
export function assessScanProducts(results:WebProductResult[],plan:ScanDiscoveryPlan,prefs:Preferences,filters:DiscoveryFilters=defaultDiscoveryFilters) {
  const matches:ScanProductMatch[]=[],needs_review:ScanProductDiscovery["needs_review"]=[];
  for(const p of results){
    const issues:string[]=[],reasons:string[]=[];
    const formula=p.full_inci_quote||p.ingredients_quote||"";
    const text=p.title+" "+formula;
    const category=sourceCategory(p.title);
    if(!p.page_opened)issues.push("The product page was not opened.");
    if(/\/collections?\/|\/shop-by-brand\/|\/categories\//i.test(p.url))issues.push("A collection page is not an individual product match.");
    if(category==="unknown")issues.push("Product category is not verified from this title.");
    if(filters.category&&category!==filters.category)issues.push("Does not match the selected category.");
    if(!sourceBrandMatches(p.title,p.host,filters.brand))issues.push("Does not match the selected brand.");
    if(filters.query&&!text.toLowerCase().includes(filters.query.toLowerCase()))issues.push("Does not match the product/ingredient search text.");
    if(filters.full_ingredients_only&&!p.full_inci_quote)issues.push("A complete published ingredient list has not been captured.");
    const suitability=p.suitability_quote||"";
    if(plan.skin_type!=="unknown"&&(!new RegExp(`\\b${plan.skin_type}\\b|all skin types`,"i").test(suitability)||/not (?:suitable|recommended|for)|avoid|except/i.test(suitability)))issues.push(`Manufacturer suitability for ${plan.skin_type} skin is not verified.`);
    else if(plan.skin_type!=="unknown")reasons.push(`The source lists ${plan.skin_type} skin or all skin types.`);
    if(!formula)issues.push("Main-product ingredient information is not verified.");
    const found=ingredients.filter(i=>has(i.id,formula)).map(i=>i.id);
    const targetMatches=plan.targets.filter(t=>{const r=concernRules.find(r=>r.id===t.id)!;return r.categories.includes(category)&&t.ingredient_ids.some(id=>found.includes(id));});
    const matched=[...new Set(targetMatches.flatMap(t=>t.ingredient_ids.filter(id=>found.includes(id))))];
    const selected=plan.priorities.length>0;
    if(selected&&!targetMatches.length)issues.push("No source-confirmed ingredient/category match for the selected concerns.");
    if(!selected&&!(["moisturizer","cleanser","sunscreen"].includes(category)||filters.category))issues.push("Not a selected basic-care category.");
    for(const t of targetMatches){const r=concernRules.find(r=>r.id===t.id)!;reasons.push(`For ${t.label.toLowerCase()}: source ingredients include ${t.ingredient_ids.filter(id=>found.includes(id)).map(id=>ingredients.find(i=>i.id===id)!.name).join(", ")}. ${r.explanation}`);}
    const sensitive=prefs.sensitive||plan.skin_type==="sensitive";
    const isRetinoid=retinoids.some(id=>has(id,text))||/retin(?:ol|al|oid)/i.test(text);
    const isExfoliant=exfoliants.some(id=>has(id,text))||/\b(?:aha|bha|pha)\b|exfoliat/i.test(text);
    if(isRetinoid&&(prefs.avoid_retinoids||!prefs.adult_confirmed||sensitive))issues.push("Retinoid does not meet your explicit avoidance, adult or sensitive-skin choices.");
    if(isExfoliant&&(!prefs.adult_confirmed||sensitive))issues.push("Exfoliant does not meet your adult/sensitive-skin choices.");
    const claims=[p.title,p.claims_quote,p.suitability_quote,formula].filter(Boolean).join(" ");
    if((prefs.fragrance_free||sensitive)&&!/fragrance[ -]?free/i.test(claims))issues.push("A fragrance-free claim is not verified.");
    if(sensitive&&!p.full_inci_quote)issues.push("Sensitive-skin filtering requires a complete published ingredient list.");
    if(prefs.non_comedogenic&&!/non[ -]?comedogenic/i.test(claims))issues.push("A non-comedogenic claim is not verified.");
    if(prefs.vegan&&!/\bvegan\b/i.test(claims))issues.push("A vegan claim is not verified.");
    if(prefs.avoid_ingredients.length){if(!p.full_inci_quote)issues.push("A complete ingredient list must be verified against your exclusions; excerpts alone cannot confirm absence.");else for(const avoid of prefs.avoid_ingredients){const canonical=ingredients.find(i=>new RegExp(i.aliases_pattern,"i").test(avoid)||i.id===avoid);const normalize=(s:string)=>s.toLowerCase().replace(/[^a-z0-9]/g,"");if(normalize(formula).includes(normalize(avoid))||canonical&&has(canonical.id,formula))issues.push(`The published ingredient list contains your excluded ingredient: ${avoid}.`);}}
    const price=quotedPrice(p.price_quote);
    if(prefs.budget_inr!==null){if(price===null)issues.push("Exact INR pack price is not verified against your budget.");else if(price>prefs.budget_inr)issues.push("Quoted price exceeds your per-product budget.");else reasons.push(`Quoted price is within your ₹${prefs.budget_inr} budget; confirm the exact pack.`);}
    if(issues.length)needs_review.push({...p,review_reasons:issues});
    else matches.push({...p,category,matched_concerns:targetMatches.map(t=>t.id),matched_ingredients:matched,rank:targetMatches.length*10+matched.length*2+(p.full_inci_quote?2:0)+(prefs.preferred_brands.some(id=>sourceBrandMatches(p.title,p.host,preferredBrandNames[id]||id))?1:0),reasons:reasons.length?reasons:["A basic-care option; no concern-specific benefit is inferred."],limitations:[...targetMatches.map(t=>concernRules.find(r=>r.id===t.id)!.limitation),...(isRetinoid?["Retinoids can irritate. Do not use during pregnancy or breastfeeding; confirm individual suitability with a qualified clinician."]:[]),"Seller statements are not proof of effectiveness. Confirm the exact pack, full formula and current price."]});
  }
  matches.sort((a,b)=>{const pa=quotedPrice(a.price_quote),pb=quotedPrice(b.price_quote);if(filters.sort!=="matches"){if(pa===null)return pb===null?0:1;if(pb===null)return -1;return filters.sort==="price-low"?pa-pb:pb-pa;}return b.rank-a.rank||(pa??Infinity)-(pb??Infinity);});
  return {matches,needs_review};
}
