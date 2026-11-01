// Explicit integration check: disposable account + generic shopping request only.
// No email delivery, real scans, saved user preferences or personal notes.
import { randomBytes, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
process.loadEnvFile(new URL("../.env.local", import.meta.url));
const url=process.env.NEXT_PUBLIC_SUPABASE_URL, anon=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const admin=createClient(url,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const cookies=new Map();
const client=createServerClient(url,anon,{cookies:{getAll:()=>[...cookies].map(([name,value])=>({name,value})),setAll:items=>items.forEach(({name,value})=>cookies.set(name,value))}});
const must=(r)=>{if(r.error)throw new Error(r.error.message);return r.data;};
const check=(value,message)=>{if(!value)throw new Error(message);console.log("PASS:",message);};
let fixtureId;
async function call(path,body,method="POST") {
 const r=await fetch("http://127.0.0.1:3000"+path,{method,headers:{"Content-Type":"application/json",origin:"http://127.0.0.1:3000",cookie:[...cookies].map(([n,v])=>n+"="+v).join("; ")},body:JSON.stringify(body)});
 return {status:r.status,data:await r.json()};
}
try {
 const email=`velqora.search.qa.${Date.now()}.${randomBytes(3).toString("hex")}@example.com`, password=randomBytes(30).toString("base64url");
 const generated=must(await admin.auth.admin.generateLink({type:"signup",email,password,options:{data:{display_name:"Product search QA"}}}));
 fixtureId=generated.user.id;
 must(await client.auth.verifyOtp({type:"signup",token_hash:generated.properties.hashed_token}));
 const blocked=await call("/api/products/search",{question:"A moisturizer under 500 rupees for dry skin"});
 check(blocked.status===403 && blocked.data.error.code==="AI_CONSENT","Authenticated user without saved AI consent is blocked");
 const saved=await call("/api/account",{display_name:"Product search QA",llm_consent:true},"PATCH");
 check(saved.status===200,"Disposable account can save its own AI preference");
 if(process.env.RUN_SCAN_DISCOVERY !== "true") {
 const result=await call("/api/products/search",{question:"A moisturizer under 500 rupees for dry skin"});
 check(result.status===200,"Authenticated Groq catalog-search endpoint responds");
 check(result.data.source==="groq" && result.data.web_search===false,"Response truthfully identifies Groq filter parsing without web search");
 check(result.data.intent.budget_inr===500 && result.data.intent.categories.includes("moisturizer") && result.data.intent.skin_type==="dry","Live model returns the requested reviewable filters");
 check(!("products" in result.data.intent),"No generated products enter the response");
 }
 const forged=await call("/api/products/search",{question:"A moisturizer",consent:true,scan_ids:["foreign"]});
 check(forged.status===400,"Client-supplied consent and scan context are rejected");
 if(process.env.RUN_SCAN_DISCOVERY === "true") {
  const scan=must(await admin.from("skin_scans").insert({user_id:fixtureId,idempotency_key:randomUUID(),status:"completed",provider_version:"youcam-v2.1-sd",completed_at:new Date().toISOString(),skin_age:36,overall_score:78.4}).select("id").single());
  must(await admin.from("skin_type_results").insert({scan_id:scan.id,region:"whole",skin_type:"Dry"}));
  must(await admin.from("skin_scan_metrics").insert([{scan_id:scan.id,metric_type:"moisture",region:"whole",ui_score:72},{scan_id:scan.id,metric_type:"tear_trough",region:"whole",ui_score:55},{scan_id:scan.id,metric_type:"pore",region:"whole",ui_score:66}]));
  const found=await call("/api/products/discover",{mode:"scan",scan_id:scan.id,preferences:{},web_consent:true});
  if(found.status!==200) console.log("Scan discovery status/code:",found.status,found.data.error?.code);
  check(found.status===200,"Owned scan drives live product discovery without a typed shopping query");
  check(found.data.plan.skin_type==="dry" && found.data.plan.targets.some(t=>t.id==="moisture"),"Dry skin creates a moisturizing-care target");
  check(!found.data.plan.search_brief.includes(scan.id) && !found.data.plan.search_brief.includes("78.4"),"Derived search brief excludes scan IDs and raw scores");
  if(!found.data.matches.length) console.log("Source gaps:",JSON.stringify(found.data.needs_review.map(p=>({title:p.title,opened:p.page_opened,ingredients:p.ingredients_quote,suitability:p.suitability_quote,issues:p.review_reasons}))));
  check(found.data.matches.length>0,"Live retrieved product evidence passes personalized suitability checks");
  check(found.data.matches.every(p=>p.reasons.length>0 && p.page_opened),"Each personalized match has source evidence and an explanation");
  console.log("PASS: Personalized matches:",found.data.matches.length,"; sources needing review:",found.data.needs_review.length);
 }
 if(process.env.RUN_WEB_DISCOVERY === "true") {
  const unacknowledged=await call("/api/products/discover",{question:"CeraVe cream in India"});
  check(unacknowledged.status===400,"Web discovery requires its own explicit acknowledgment");
  const web=await call("/api/products/discover",{question:"Find CeraVe Moisturising Cream on its official India product page. Open it for ingredients.",web_consent:true});
  check(web.status===200,"Authenticated live web discovery responds");
  check(web.data.source==="groq-web" && web.data.results.some(r=>r.host.endsWith("ceraveindia.com")),"Live sources include a brand outside the local catalog");
  check(web.data.results.some(r=>r.ingredients_quote || r.suitability_quote),"Retrieved source excerpts reach the API response");
  check(web.data.results.every(r=>!("page_text" in r)),"Raw provider page text is not exposed as result facts");
 }
} finally {
 await client.auth.signOut({scope:"global"});
 if(fixtureId){must(await admin.auth.admin.deleteUser(fixtureId));console.log("PASS: Exact disposable account and cascading fixtures removed");}
}
