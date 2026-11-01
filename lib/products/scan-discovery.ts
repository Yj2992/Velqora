import type { Scan } from "../types";
import type { Preferences } from "./types";
import { scanSkinType, relativeFocus } from "./engine";
import { concernRules, retinoids, exfoliants, scoreInterpretation, type ConcernId } from "./rules";
import ingredients from "../../data/ingredients.catalog.json";
import type { WebProductResult, WebProductSearch } from "./web-results";
export type ScanDiscoveryPlan = {
  skin_type: Preferences["skin_type"];
  priorities: {id:ConcernId;label:string;score:number}[];
  targets: {id:ConcernId;label:string;reason:string;ingredient_ids:string[]}[];
  guidance: {label:string;text:string;source:string}[];
  search_brief: string;
};
export type ScanProductMatch = WebProductResult & {reasons:string[];limitations:string[];category:string;matched_ingredients:string[]};
export type ScanProductDiscovery = WebProductSearch & {scan_id:string;plan:ScanDiscoveryPlan;matches:ScanProductMatch[];needs_review:(WebProductResult & {review_reasons:string[]})[]};
export function buildScanDiscoveryPlan(scan:Scan,prefs:Preferences):ScanDiscoveryPlan {
  if(scan.status!=="completed" || scan.provider_version!==scoreInterpretation.supportedProvider)throw new Error("Automatic product discovery requires a completed scan with verified YouCam score interpretation.");
  const skin_type=prefs.skin_type === "unknown" ? scanSkinType(scan) : prefs.skin_type;
  const priorities=relativeFocus(scan).map(p=>({...p,label:concernRules.find(r=>r.id===p.id)!.label}));
  const targets:ScanDiscoveryPlan["targets"]=[];
  if(skin_type==="dry" || skin_type==="sensitive")targets.push({id:"moisture",label:"Hydration & everyday barrier care",reason:`${prefs.skin_type === "unknown" ? "Your scan lists" : "Your chosen preference is"} ${skin_type} skin. Start with gentle moisturizing care.`,ingredient_ids:["glycerin","ceramides","hyaluronic_acid","panthenol","squalane"]});
  for(const p of priorities){
    const r=concernRules.find(r=>r.id===p.id)!;
    if(r.support!=="cosmetic" || targets.some(t=>t.id===r.id))continue;
    const ids=r.ingredients.filter(id=>!retinoids.includes(id) && (prefs.adult_confirmed && !prefs.sensitive && skin_type!=="sensitive" || !exfoliants.includes(id)));
    if(ids.length)targets.push({id:r.id,label:r.label,reason:`${r.label} is a lower relative score in this scan (${p.score}/100), not a severity grade.`,ingredient_ids:ids});
  }
  const guidance=priorities.flatMap(p=>{const r=concernRules.find(r=>r.id===p.id)!;return r.support!=="cosmetic" ? [{label:r.label,text:r.limitation,source:r.source}] : [];});
  if(priorities.some(p=>p.id==="pore") && !targets.some(t=>t.id==="pore"))guidance.push({label:"Pore appearance",text:"Pore-focused exfoliants and retinoids are not requested without the relevant suitability choices. Products cannot permanently close pores. Everyday care remains a separate starting point.",source:concernRules.find(r=>r.id==="pore")!.source});
  const wanted=[...new Set(targets.flatMap(t=>t.ingredient_ids))].map(id=>ingredients.find(i=>i.id===id)?.name || id);
  const constraints=[prefs.budget_inr!==null?`Maximum INR ${prefs.budget_inr} per product; verify exact pack price.`:"",prefs.avoid_ingredients.length?`Avoid ingredients: ${prefs.avoid_ingredients.join(", ")}. A complete formula must be checked; do not assume absence.`:"",prefs.fragrance_free?"Manufacturer must explicitly state fragrance-free.":"",prefs.non_comedogenic?"Manufacturer must explicitly state non-comedogenic.":"",prefs.vegan?"Manufacturer must explicitly state vegan.":"",prefs.sensitive || skin_type==="sensitive"?"Conservative sensitive-skin care; no exfoliants or retinoids.":"",!prefs.adult_confirmed?"Actual adult age is not confirmed. Do not seek exfoliating acids or retinoids.":""].filter(Boolean);
  // Only this derived brief goes to search providers: no scores, scan IDs, photos or skin-age estimates.
  const search_brief=`Find individual skincare product pages available in India for ${skin_type === "unknown" ? "unspecified" : skin_type} skin. Prioritize a gentle daily moisturizer, then a gentle cleanser and broad-spectrum SPF 30+ sunscreen with source-confirmed suitability. Prefer moisturizer ingredient support from ${wanted.join(", ") || "glycerin or ceramides"}. Cosmetic focus: ${targets.map(t=>t.label).join(", ") || "basic everyday care"}. Do not seek creams to correct tear troughs, eye bags, eyelid position or dark circles. No retinoids. ${constraints.join(" ")} Discover products beyond a local catalog, preferably official Indian brand product pages. Open up to three individual product pages for main-product ingredient and skin-suitability information.`;
  return {skin_type,priorities,targets,guidance,search_brief};
}
const has=(id:string,text:string)=>{const item=ingredients.find(i=>i.id===id);return item ? new RegExp(item.aliases_pattern,"i").test(text) : false;};
export function assessScanProducts(results:WebProductResult[],plan:ScanDiscoveryPlan,prefs:Preferences) {
  const matches:ScanProductMatch[]=[],needs_review:ScanProductDiscovery["needs_review"]=[];
  for(const p of results){
    const issues:string[]=[],reasons:string[]=[];
    const text=p.title+" "+(p.ingredients_quote||"");
    const category=/sunscreen|sun screen|\bSPF\b/i.test(p.title)?"sunscreen":/eye\s*(?:cream|serum|gel)/i.test(p.title)?"eye_care":/cleanser|face\s*wash|cleansing|wash gel/i.test(p.title)?"cleanser":/moisturi[sz]|hydrating cream|hydration cream/i.test(p.title)?"moisturizer":"unknown";
    if(!p.page_opened)issues.push("The product page was not opened.");
    if(/\/collections?\/|\/shop-by-brand\/|\/categories\//i.test(p.url))issues.push("A collection page is not an individual product match.");
    if(category==="unknown" || category==="eye_care")issues.push("No supported everyday-care product category verified from this title.");
    const suitability=p.suitability_quote || "";
    if(plan.skin_type!=="unknown" && (!new RegExp(`\\b${plan.skin_type}\\b|all skin types`,"i").test(suitability) || /not (?:suitable|recommended|for)|avoid|except/i.test(suitability)))issues.push(`Manufacturer suitability for ${plan.skin_type} skin is not verified.`);
    else if(plan.skin_type!=="unknown")reasons.push(`The retrieved manufacturer statement lists ${plan.skin_type} skin or all skin types.`);
    if(!p.ingredients_quote)issues.push("Main-product ingredient information is not verified.");
    const found=ingredients.filter(i=>has(i.id,p.ingredients_quote||"")).map(i=>i.id);
    const matched=found.filter(id=>plan.targets.some(t=>t.ingredient_ids.includes(id)));
    if(category==="moisturizer" && !matched.length)issues.push("No source-confirmed ingredient match for the scan-derived care targets.");
    if(matched.length)reasons.push(`Source ingredient support: ${matched.map(id=>ingredients.find(i=>i.id===id)!.name).join(", ")}.`);
    if(retinoids.some(id=>has(id,text)) || /retin(?:ol|al|oid)/i.test(text))issues.push("Retinoids are excluded from this automatic starter shortlist.");
    if((!prefs.adult_confirmed || prefs.sensitive || plan.skin_type==="sensitive") && (exfoliants.some(id=>has(id,text)) || /\b(?:aha|bha|pha)\b|exfoliat/i.test(text)))issues.push("An exfoliating active does not meet the current suitability choices.");
    const claims=[p.title,p.suitability_quote,p.ingredients_quote].filter(Boolean).join(" ");
    if(prefs.fragrance_free && !/fragrance[ -]?free/i.test(claims))issues.push("A fragrance-free claim is not verified.");
    if(prefs.non_comedogenic && !/non[ -]?comedogenic/i.test(claims))issues.push("A non-comedogenic claim is not verified.");
    if(prefs.vegan && !/\bvegan\b/i.test(claims))issues.push("A vegan claim is not verified.");
    if(prefs.avoid_ingredients.length)issues.push("A complete ingredient list must be verified against your exclusions; excerpts alone cannot confirm absence.");
    if(prefs.budget_inr!==null){const amounts=[...(p.price_quote||"").matchAll(/(?:₹|INR|Rs\.?)\s*([\d,]+(?:\.\d{1,2})?)/gi)].map(m=>Number(m[1].replaceAll(",",""))).filter(n=>Number.isFinite(n)&&n>0);if(!amounts.length)issues.push("Exact INR pack price is not verified against your budget.");else if(Math.max(...amounts)>prefs.budget_inr)issues.push("The quoted price exceeds your per-product budget.");else reasons.push(`The quoted INR amount is within your ₹${prefs.budget_inr} limit; confirm the exact pack at the source.`);}
    if(category==="sunscreen" && !/SPF\s*(?:[3-9]\d|\d{3})\b/i.test(p.title))issues.push("SPF 30+ is not established by this retrieved title.");
    if(category==="sunscreen" && !/broad[ -]?spectrum|PA\+{2,}/i.test(claims))issues.push("A broad-spectrum or UVA-protection statement is not verified.");
    if(issues.length)needs_review.push({...p,review_reasons:issues});
    else matches.push({...p,category,matched_ingredients:matched,reasons:[...reasons,category==="moisturizer"?"Moisturizing care is a starting point for your skin type and selected cosmetic priorities.":`A ${category} is an everyday-care foundation, not a treatment for structural eye concerns.`],limitations:["Source statements are brand claims, not proof of effectiveness. Confirm the exact pack, full ingredients and current price.","A scan does not diagnose a condition or establish which product will improve it."]});
  }
  const order:Record<string,number>={moisturizer:0,cleanser:1,sunscreen:2};
  matches.sort((a,b)=>(order[a.category]??9)-(order[b.category]??9));
  return {matches,needs_review};
}
