import { NextResponse } from "next/server";
import { z } from "zod";
import { auth, quota, scanSelect } from "@/lib/server/auth";
import { AppError, checked, required, fail } from "@/lib/server/errors";
import { searchWebProducts } from "@/lib/ai/web-product-search";
import type { Scan } from "@/lib/types";
import { preferencesSchema } from "@/lib/products/types";
import { buildScanDiscoveryPlan, assessScanProducts } from "@/lib/products/scan-discovery";
export const maxDuration=90;
const input=z.union([
 z.object({question:z.string().trim().min(5).max(1000),web_consent:z.literal(true)}).strict(),
 z.object({mode:z.literal("scan"),scan_id:z.string().uuid(),preferences:preferencesSchema,web_consent:z.literal(true)}).strict(),
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
      try {plan=buildScanDiscoveryPlan(row as unknown as Scan,requestInput.preferences);}
      catch {throw new AppError("SCAN_UNSUPPORTED","This scan’s provider version does not support automatic interpretation. Choose a supported YouCam scan.",400);}
      await quota(db,user.id,"product-web-search",5);
      const found=await searchWebProducts(plan.search_brief,true);
      result={...found,scan_id:requestInput.scan_id,plan,...assessScanProducts(found.results,plan,requestInput.preferences)};
    } else {
      await quota(db,user.id,"product-web-search",5);
      result=await searchWebProducts(requestInput.question,true);
    }
    return NextResponse.json(result,{headers:{"Cache-Control":"private, no-store"}});
  } catch(e){return fail(e);}
}
