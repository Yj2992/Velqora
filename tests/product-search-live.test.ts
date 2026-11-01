import { it, expect } from "vitest";
import { interpretProductSearch } from "../lib/ai/product-search";
// Opt-in smoke check: sends only this synthetic shopping query, never account data.
it.skipIf(process.env.RUN_GROQ_SEARCH_SMOKE !== "true")("live Groq parses a generic shopping request", async()=>{
 process.loadEnvFile(".env.local");
 const result=await interpretProductSearch("A fragrance-free moisturizer under 500 rupees for dry skin",["Minimalist","Deconstruct","Plum","Dot & Key","Re’equil"],true);
 expect(result.categories).toContain("moisturizer");expect(result.budget_inr).toBe(500);expect(result.skin_type).toBe("dry");expect(result.fragrance_free).toBe(true);
},30000);
it.skipIf(process.env.RUN_GEMINI_SMOKE !== "true")("live Gemini parses a generic shopping request", async()=>{
 process.loadEnvFile(".env.local");
 process.env.AI_PROVIDER="gemini";
 const result=await interpretProductSearch("A fragrance-free moisturizer under 500 rupees for dry skin",["Minimalist","Deconstruct","Plum","Dot & Key","Re’equil"],true);
 expect(result.categories).toContain("moisturizer");expect(result.budget_inr).toBe(500);expect(result.skin_type).toBe("dry");expect(result.fragrance_free).toBe(true);
},30000);
