import { it, expect, vi, afterEach } from "vitest";
import { collectWebSources, evidenceExcerpt, buildWebResults, safePublicWebUrl } from "../lib/products/web-results";
import { searchWebProducts } from "../lib/ai/web-product-search";
const url="https://www.ceraveindia.com/ceramides-skin-care/moisturisers/moisturising-cream";
const message={content:"Invented product at https://fake.example.com/products/fake",executed_tools:[
 {name:"browser.search",search_results:{results:[{title:"CeraVe Moisturising Cream",url,content:""},{title:"Internal",url:"https://127.0.0.1/"}]}},
 {name:"browser.open",output:`L0: \nL1: URL:\nL2: ${url}\nL3: CeraVe Moisturising Cream\nL4: Ingredients: glycerin and ceramides.\nL5: Suitable for dry skin.\nL6: Price: ₹500 for 50g.\nL7: Main product details and manufacturer information.`},
]};
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();});
const groqOnly = () => {
  vi.stubEnv("AI_PROVIDER", "");
  vi.stubEnv("GEMINI_API_KEY", "");
};
it("uses actual search-tool metadata, never assistant-invented names or links",()=>{
 const sources=collectWebSources(message);expect(sources).toHaveLength(1);expect(sources[0].url).toBe(url);expect(sources[0].opened).toBe(true);expect(JSON.stringify(sources)).not.toContain("fake.example");
 expect(collectWebSources({content:"A product https://brand.com/product"})).toEqual([]);
});
it("blocks unsafe link schemes, credentials, local hosts and non-web ports",()=>{
 for(const s of ["javascript:alert(1)","http://brand.com/x","https://127.0.0.1/x","https://[::1]/","https://localhost/x","https://shop.internal/x","https://a:b@brand.com/x","https://brand.com:8080/x"]){expect(safePublicWebUrl(s)).toBeNull();}
 expect(safePublicWebUrl(url)).toBe(url);
});
it("accepts only literal retrieved-page excerpts, leaving fabricated facts unknown",()=>{
 const sources=collectWebSources(message);
 const [r]=buildWebResults(sources,{pages:[{index:0,price_quote:"Price: ₹500 for 50g.",ingredients_quote:"Contains magical gold",suitability_quote:"Suitable for dry skin."}]});
 expect(r.price_quote).toBe("Price: ₹500 for 50g.");expect(r.ingredients_quote).toBeNull();expect(r.suitability_quote).toBe("Suitable for dry skin.");expect(r).not.toHaveProperty("page_text");
});
it("does not attach quotes to search-only pages or unrelated opened URLs",()=>{
 const sources=collectWebSources({executed_tools:[message.executed_tools[0],{name:"browser.open",output:"URL:\nhttps://otherbrand.com/product\nProduct price: ₹500 for 50g. Real page text but not a searched URL."}]});
 const [r]=buildWebResults(sources,{pages:[{index:0,price_quote:"₹500 for 50g",ingredients_quote:null,suitability_quote:null}]});expect(r.page_opened).toBe(false);expect(r.price_quote).toBeNull();
});
it("enforces consent before even a browser-search request",async()=>{
 vi.stubEnv("GROQ_API_KEY","test");vi.stubEnv("GEMINI_API_KEY","");vi.stubEnv("LLM_DATA_SHARING_ENABLED","true");const f=vi.fn();vi.stubGlobal("fetch",f);
 await expect(searchWebProducts("A moisturizer",false)).rejects.toThrow("confirm");expect(f).not.toHaveBeenCalled();
});
it("requires live source tool results, with no generative fallback",async()=>{
 vi.stubEnv("GROQ_API_KEY","test");vi.stubEnv("GEMINI_API_KEY","");vi.stubEnv("LLM_DATA_SHARING_ENABLED","true");vi.stubGlobal("fetch",vi.fn().mockResolvedValue(new Response(JSON.stringify({choices:[{message:{content:"Some made up product"}}]}))));
 await expect(searchWebProducts("A moisturizer",true)).rejects.toThrow("No usable live source");
});
it("uses browser tools and returns honest missing details if extraction fails",async()=>{
 vi.stubEnv("GROQ_API_KEY","test");vi.stubEnv("GEMINI_API_KEY","");vi.stubEnv("LLM_DATA_SHARING_ENABLED","true");
 const f=vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({choices:[{message}]}))).mockResolvedValueOnce(new Response("",{status:429}));vi.stubGlobal("fetch",f);
 const r=await searchWebProducts("CeraVe cream in India",true);
 expect(r.evidence_status).toBe("unavailable");expect(r.source).toBe("groq-web");expect(r.results[0].title).toBe("CeraVe Moisturising Cream");expect(r.results[0].price_quote).toBeNull();
 const request=JSON.parse(f.mock.calls[0][1].body);expect(request.tool_choice).toBe("required");expect(request.tools).toEqual([{type:"browser_search"}]);expect(request).not.toHaveProperty("response_format");expect(f.mock.calls.every(c=>c[0]==="https://api.groq.com/openai/v1/chat/completions")).toBe(true);
});
it("reports exhausted free web quotas without a paid provider fallback",async()=>{
 vi.stubEnv("GROQ_API_KEY","test");vi.stubEnv("GEMINI_API_KEY","");vi.stubEnv("LLM_DATA_SHARING_ENABLED","true");const f=vi.fn().mockResolvedValue(new Response("",{status:429}));vi.stubGlobal("fetch",f);
 await expect(searchWebProducts("A moisturizer",true)).rejects.toThrow("free Groq search quota");expect(f).toHaveBeenCalledTimes(1);
});
it("falls back to Gemini web discovery when Groq web-search model is unavailable for the account",async()=>{
 vi.stubEnv("GROQ_API_KEY","test");vi.stubEnv("GEMINI_API_KEY","test-gemini");vi.stubEnv("GEMINI_MODEL","gemini-3.5-flash-lite");vi.stubEnv("LLM_DATA_SHARING_ENABLED","true");
 const f=vi.fn()
   .mockResolvedValueOnce(new Response("Model unavailable",{status:400}))
   .mockResolvedValueOnce(new Response(JSON.stringify({candidates:[{finishReason:"STOP",groundingMetadata:{groundingChunks:[{web:{uri:url,title:"CeraVe Moisturising Cream"}}]},content:{parts:[{text:url}]}}]})))
   .mockResolvedValueOnce(new Response("<html><head><title>CeraVe Moisturising Cream</title></head><body>Ingredients: Aqua, Glycerin, Ceramide NP, Sodium Hyaluronate. Suitable for dry skin. Price: ₹500 for 50g.</body></html>",{status:200}))
   .mockResolvedValueOnce(new Response(JSON.stringify({candidates:[{finishReason:"STOP",content:{parts:[{text:JSON.stringify({pages:[{index:0,price_quote:"Price: ₹500 for 50g.",ingredients_quote:"Ingredients: Aqua, Glycerin, Ceramide NP, Sodium Hyaluronate.",suitability_quote:"Suitable for dry skin.",full_inci_quote:"Ingredients: Aqua, Glycerin, Ceramide NP, Sodium Hyaluronate.",claims_quote:null}]})}]}}]})));
 vi.stubGlobal("fetch",f);
 const r=await searchWebProducts("CeraVe cream in India",true);
 expect(r.results).toHaveLength(1);
 expect(r.results[0].url).toBe(url);
 expect(r.results[0].price_quote).toBe("Price: ₹500 for 50g.");
 expect(r.results[0].suitability_quote).toBe("Suitable for dry skin.");
});

it("requires a verbatim headed formula for full-list filtering",()=>{
 const full="Ingredients: Aqua, Glycerin, Ceramide NP, Sodium Hyaluronate";
 const sources=[{title:"Cream",url,host:"www.ceraveindia.com",opened:true,page_text:full+". Fragrance-free.",snippet:""}];
 const [verified]=buildWebResults(sources,{pages:[{index:0,price_quote:null,ingredients_quote:"Glycerin",suitability_quote:null,full_inci_quote:full,claims_quote:"Fragrance-free."}]});
 expect(verified.full_inci_quote).toBe(full);expect(verified.claims_quote).toBe("Fragrance-free.");
 const [rejected]=buildWebResults(sources,{pages:[{index:0,price_quote:null,ingredients_quote:null,suitability_quote:null,full_inci_quote:"Aqua, Glycerin, Ceramide NP, Sodium Hyaluronate",claims_quote:"Vegan"}]});
 expect(rejected.full_inci_quote).toBeNull();expect(rejected.claims_quote).toBeNull();
});

it("keeps late suitability and ingredient evidence within the extraction budget",()=>{
 const text="Navigation and marketing. ".repeat(800)+"Suitable for dry skin. Ingredients: Aqua, Glycerin, Ceramide NP, Sodium Hyaluronate. Price: ₹499. "+"Footer ".repeat(500);
 const excerpt=evidenceExcerpt(text);expect(excerpt.length).toBeLessThanOrEqual(5000);expect(excerpt).toContain("Suitable for dry skin.");expect(excerpt).toContain("Ingredients: Aqua, Glycerin");
 expect(evidenceExcerpt("Short product text")).toBe("Short product text");
});
it("retains late opened-page evidence before selecting extraction spans",()=>{
 const long={executed_tools:[message.executed_tools[0],{name:"browser.open",output:`URL:\n${url}\n`+"Navigation ".repeat(1600)+"Suitable for dry skin. Ingredients: Aqua, Glycerin, Ceramide NP, Sodium Hyaluronate."}]};
 const sources=collectWebSources(long);expect(sources[0].page_text).toContain("Suitable for dry skin.");expect(evidenceExcerpt(sources[0].page_text)).toContain("Suitable for dry skin.");
});

it("retains a directly opened public reference while rejecting unrelated opens",()=>{
 const opened={executed_tools:[{name:"browser.open",output:`URL:\n${url}\nIngredients: Aqua, Glycerin, Ceramide NP, Sodium Hyaluronate. Suitable for dry skin.`}]};
 expect(collectWebSources(opened)).toEqual([]);
 const sources=collectWebSources(opened,[{name:"CeraVe Moisturising Cream",url:url+"?pack=50g"}]);
 expect(sources).toHaveLength(1);expect(sources[0].opened).toBe(true);expect(sources[0].url).toBe(url);
});
