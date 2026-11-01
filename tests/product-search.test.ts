import { it, expect, vi, afterEach } from "vitest";
import { interpretProductSearch } from "../lib/ai/product-search";
import { productIntentSchema, mergeSearchPreferences, matchesSearchIntent } from "../lib/products/search-intent";
import { defaultPreferences, type Product } from "../lib/products/types";
import { recommend } from "../lib/products/engine";
import catalog from "../data/products.catalog.json";
const intent = productIntentSchema.parse({skin_type:"dry",budget_inr:500,categories:["moisturizer"],concerns:[],ingredient_ids:[],avoid_ingredients:[],brand_names:[],fragrance_free:true,non_comedogenic:false,vegan:false,sensitive:false,unresolved_terms:[]});
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();});
it("does not permit products, age consent or unsafe preference changes in model output",()=>{
 for(const extra of [{products:["invented"]},{adult_confirmed:true},{avoid_retinoids:false},{ingredients:["miracle"]}]) expect(productIntentSchema.safeParse({...intent,...extra}).success).toBe(false);
 expect(productIntentSchema.safeParse({...intent,ingredient_ids:["invented"]}).success).toBe(false);
 expect(productIntentSchema.safeParse({...intent,budget_inr:-1}).success).toBe(false);
});
it("keeps stricter budgets, ingredient exclusions and all safety choices",()=>{
 const current={...defaultPreferences,skin_type:"sensitive" as const,budget_inr:300,avoid_ingredients:["niacinamide"],vegan:true,sensitive:true};
 const merged=mergeSearchPreferences(current,{...intent,avoid_ingredients:["fragrance"]});
 expect(merged).toMatchObject({budget_inr:300,skin_type:"sensitive",avoid_ingredients:["niacinamide","fragrance"],fragrance_free:true,vegan:true,sensitive:true,adult_confirmed:false,avoid_retinoids:true});
});
it("never discards exclusions to fit schema limits",()=>{
 expect(()=>mergeSearchPreferences({...defaultPreferences,avoid_ingredients:Array.from({length:20},(_,i)=>"avoid-"+i)},{...intent,avoid_ingredients:["one more"]})).toThrow();
});
it("applies categories, brand names and ingredient constraints to real catalog records",()=>{
 const p={...(catalog as Product[])[0],brand:"Minimalist",category:"moisturizer" as const,ingredient_ids:["glycerin"]};
 expect(matchesSearchIntent(p,{...intent,brand_names:["Minimalist"],ingredient_ids:["glycerin"]})).toBe(true);
 expect(matchesSearchIntent(p,{...intent,brand_names:["Unknown Brand"]})).toBe(false);
 expect(matchesSearchIntent(p,{...intent,ingredient_ids:["niacinamide"]})).toBe(false);
 expect(matchesSearchIntent({...p,category:"serum"},intent)).toBe(false);
});
it("keeps generated filters inside rule-based product eligibility",()=>{
 const prefs=mergeSearchPreferences({...defaultPreferences,skin_type:"unknown"},intent);
 const found=recommend(catalog as Product[],prefs,[],Date.parse("2026-11-01T12:00:00Z"),true).filter(m=>matchesSearchIntent(m.product,intent));
 for(const {product:p} of found){expect(p.price_inr).toBeLessThanOrEqual(500);expect(p.fragrance_free).toBe(true);expect(p.category).toBe("moisturizer");expect(p.skin_types).toContain("dry");}
 const fixture={...(catalog as Product[])[0], name:"Test moisturizer", category:"moisturizer" as const, ingredient_ids:["glycerin"], skin_types:["dry"],fragrance_free:true,price_inr:450,available:true};
 expect(recommend([fixture],prefs,[],Date.parse("2026-11-01T12:00:00Z"),true).filter(m=>matchesSearchIntent(m.product,intent))).toHaveLength(1);
});
it("requires both consent and server opt-in before any request",async()=>{
 vi.stubEnv("GROQ_API_KEY","test");vi.stubEnv("LLM_DATA_SHARING_ENABLED","true");const f=vi.fn();vi.stubGlobal("fetch",f);
 await expect(interpretProductSearch("Dry skin moisturizer",[],false)).rejects.toThrow("sharing");
 vi.stubEnv("LLM_DATA_SHARING_ENABLED","false");
 await expect(interpretProductSearch("Dry skin moisturizer",[],true)).rejects.toThrow("not configured");
 expect(f).not.toHaveBeenCalled();
});
it("requests structured filters only and validates model output",async()=>{
 vi.stubEnv("GROQ_API_KEY","test");vi.stubEnv("LLM_DATA_SHARING_ENABLED","true");
 const f=vi.fn().mockResolvedValue(new Response(JSON.stringify({choices:[{finish_reason:"stop",message:{content:JSON.stringify(intent)}}]})));vi.stubGlobal("fetch",f);
 expect(await interpretProductSearch("Dry skin moisturizer under 500",["Minimalist"],true)).toEqual(intent);
 const args=f.mock.calls[0];expect(args[0]).toBe("https://api.groq.com/openai/v1/chat/completions");
 const b=JSON.parse(args[1].body);expect(b.response_format.json_schema.strict).toBe(true);
 expect(Object.keys(JSON.parse(b.messages[1].content)).sort()).toEqual(["request","knownBrands","concerns","ingredients"].sort());
 f.mockResolvedValue(new Response(JSON.stringify({choices:[{finish_reason:"stop",message:{content:JSON.stringify({...intent,products:["fake"]})}}]})));
 await expect(interpretProductSearch("A moisturizer",[],true)).rejects.toThrow("reliably");
});
it("reports free quota exhaustion without switching providers",async()=>{
 vi.stubEnv("GROQ_API_KEY","test");vi.stubEnv("LLM_DATA_SHARING_ENABLED","true");const f=vi.fn().mockResolvedValue(new Response("",{status:429}));vi.stubGlobal("fetch",f);
 await expect(interpretProductSearch("A moisturizer",[],true)).rejects.toThrow("free Groq quota");expect(f).toHaveBeenCalledTimes(1);
});
it("rejects truncated structured output",async()=>{
 vi.stubEnv("GROQ_API_KEY","test");vi.stubEnv("LLM_DATA_SHARING_ENABLED","true");vi.stubGlobal("fetch",vi.fn().mockResolvedValue(new Response(JSON.stringify({choices:[{finish_reason:"length",message:{content:JSON.stringify(intent)}}]}))));
 await expect(interpretProductSearch("A moisturizer",[],true)).rejects.toThrow("reliably");
});

it("unresolved requirements cannot become supposedly complete matches",()=>{
 const unresolved={...intent,unresolved_terms:["SPF 50 not represented"]};
 expect(()=>mergeSearchPreferences(defaultPreferences,unresolved)).toThrow("unsupported");
 expect(matchesSearchIntent((catalog as Product[])[0],unresolved)).toBe(false);
});
it("pregnancy suitability cannot be implied by parsed filters",async()=>{
 vi.stubEnv("GROQ_API_KEY","test");vi.stubEnv("LLM_DATA_SHARING_ENABLED","true");
 vi.stubGlobal("fetch",vi.fn().mockResolvedValue(new Response(JSON.stringify({choices:[{finish_reason:"stop",message:{content:JSON.stringify(intent)}}]}))));
 const parsed=await interpretProductSearch("A moisturizer safe during pregnancy",[],true);
 expect(parsed.unresolved_terms.join(" ")).toContain("Pregnancy");
 expect(()=>mergeSearchPreferences(defaultPreferences,parsed)).toThrow();
});
