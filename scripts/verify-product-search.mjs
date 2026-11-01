// Explicit integration check: disposable account + generic shopping request only.
// No email delivery, real scans, saved user preferences or personal notes.
import { randomBytes } from "node:crypto";
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
 const result=await call("/api/products/search",{question:"A moisturizer under 500 rupees for dry skin"});
 check(result.status===200,"Authenticated Groq catalog-search endpoint responds");
 check(result.data.source==="groq" && result.data.web_search===false,"Response truthfully identifies Groq filter parsing without web search");
 check(result.data.intent.budget_inr===500 && result.data.intent.categories.includes("moisturizer") && result.data.intent.skin_type==="dry","Live model returns the requested reviewable filters");
 check(!("products" in result.data.intent),"No generated products enter the response");
 const forged=await call("/api/products/search",{question:"A moisturizer",consent:true,scan_ids:["foreign"]});
 check(forged.status===400,"Client-supplied consent and scan context are rejected");
} finally {
 await client.auth.signOut({scope:"global"});
 if(fixtureId){must(await admin.auth.admin.deleteUser(fixtureId));console.log("PASS: Exact disposable account and cascading fixtures removed");}
}
