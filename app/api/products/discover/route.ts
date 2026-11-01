import { NextResponse } from "next/server";
import { z } from "zod";
import { auth, quota, scanSelect } from "@/lib/server/auth";
import { AppError, checked, required, fail } from "@/lib/server/errors";
import { searchWebProducts } from "@/lib/ai/web-product-search";
import type { Scan } from "@/lib/types";
import publicCatalog from "@/data/products.catalog.json";
import { recommend } from "@/lib/products/engine";
import { sourceBrandMatches } from "@/lib/products/discovery-filters";
import type { Product } from "@/lib/products/types";
import { preferencesSchema } from "@/lib/products/types";
import { defaultDiscoveryFilters, discoveryFiltersSchema } from "@/lib/products/discovery-filters";
import { buildScanDiscoveryPlan, assessScanProducts } from "@/lib/products/scan-discovery";
export const maxDuration=90;
const input=z.union([
 z.object({question:z.string().trim().min(5).max(1000),web_consent:z.literal(true)}).strict(),
 z.object({mode:z.literal("scan"),scan_id:z.string().uuid(),preferences:preferencesSchema,filters:discoveryFiltersSchema.default(defaultDiscoveryFilters),web_consent:z.literal(true)}).strict(),
]);
export async function POST(request:Request) {
  try {
    const {user,db}=await auth(request);
    const requestInput=input.parse(await request.json());
    const profile=required(await db.from("profiles").select("llm_consent").eq("id",user.id).single());
    if(profile.llm_consent!==true)throw new AppError("AI_CONSENT","Enable external AI sharing in Settings before using web discovery.",403);
    let result;
    if ("mode" in requestInput) {
      const row=checked(await db.from("skin_scans").select(scanSelect).eq("id",requestInput.scan_id).eq("user_id",user.id).eq("status","completed").maybeSingle());
      if(!row)throw new AppError("NOT_FOUND","Choose one of your completed scans.",404);
      let plan;
      try {plan=buildScanDiscoveryPlan(row as unknown as Scan,requestInput.preferences,requestInput.filters);}
      catch {throw new AppError("SCAN_UNSUPPORTED","This scan’s provider version does not support automatic interpretation. Choose a supported YouCam scan.",400);}
      await quota(db,user.id,"product-web-search",50);
      const f=requestInput.filters;
      const filterLead=({product:p}:{product:Product})=>(!f.category||p.category===f.category)&&(!f.brand||sourceBrandMatches(p.name,new URL(p.official_url).hostname,f.brand))&&(!f.full_ingredients_only||p.inci_complete)&&(!f.query||[p.name,...p.ingredient_ids].join(" ").toLowerCase().includes(f.query.toLowerCase()));
      const leadsMap=new Map<string,{name:string;url:string}>();
      const targetCategories=[...new Set(plan.targets.flatMap(t=>t.id==="dark_circle_v2"?["eye_care"]:[]))];
      // Ensure eye_care or explicit category targets get a dedicated starting reference lead when multi-concern scans are run
      for(const cat of targetCategories){
        for(const item of recommend(publicCatalog as Product[],{...requestInput.preferences,skin_type:plan.skin_type},plan.priorities.map(p=>p.id)).filter(m=>m.product.category===cat&&filterLead(m)).slice(0,2)){
          leadsMap.set(item.product.official_url,{name:item.product.name,url:item.product.official_url});
        }
      }
      for(const item of recommend(publicCatalog as Product[],{...requestInput.preferences,skin_type:plan.skin_type},plan.priorities.map(p=>p.id)).filter(filterLead).slice(0,4)){
        if(leadsMap.size>=4)break;
        leadsMap.set(item.product.official_url,{name:item.product.name,url:item.product.official_url});
      }
      const leads=[...leadsMap.values()].slice(0,4);
      const found=await searchWebProducts(plan.search_brief,true,leads);
      result={...found,scan_id:requestInput.scan_id,plan,...assessScanProducts(found.results,plan,requestInput.preferences,requestInput.filters)};
    } else {
      await quota(db,user.id,"product-web-search",50);
      result=await searchWebProducts(requestInput.question,true);
    }
    return NextResponse.json(result,{headers:{"Cache-Control":"private, no-store"}});
  } catch(e){return fail(e);}
}
