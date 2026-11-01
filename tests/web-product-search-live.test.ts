import { it, expect } from "vitest";
import { searchWebProducts } from "../lib/ai/web-product-search";
it.skipIf(process.env.RUN_GROQ_WEB_SMOKE!=="true")("live source discovery finds a brand outside the local catalog",async()=>{
 process.loadEnvFile(".env.local");
 const r=await searchWebProducts("Find CeraVe Moisturising Cream on its official India product page. Open the page for ingredients.",true);
 expect(r.results.length).toBeGreaterThan(0);expect(r.results.some(s=>s.host.endsWith("ceraveindia.com"))).toBe(true);
 expect(r.results.some(s=>s.page_opened)).toBe(true);
 expect(r.results.some(s=>s.ingredients_quote || s.suitability_quote)).toBe(true);
 console.log("Retrieved live pages:",r.results.length,"; opened:",r.results.filter(s=>s.page_opened).length,"; grounded excerpts:",r.results.filter(s=>s.ingredients_quote || s.price_quote || s.suitability_quote).length);
},75000);
