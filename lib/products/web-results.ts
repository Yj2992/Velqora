import { z } from "zod";
export type WebProductSource = {
  title: string;
  url: string;
  host: string;
  page_text: string;
  opened: boolean;
};
export type WebProductResult = {
  title: string;
  url: string;
  host: string;
  page_opened: boolean;
  price_quote: string | null;
  ingredients_quote: string | null;
  suitability_quote: string | null;
  full_inci_quote?: string | null;
  claims_quote?: string | null;
};
export type WebProductSearch = { source: "groq-web"; model: string; searched_at: string; results: WebProductResult[]; evidence_status?: "complete" | "unavailable" | "no_open_pages" };
export function safePublicWebUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 2000) return null;
  try {
    const u = new URL(value);
    if (u.protocol !== "https:" || u.username || u.password || (u.port && u.port !== "443")) return null;
    const h = u.hostname.toLowerCase();
    if (!/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$/.test(h) || /\.(?:local|localhost|internal|test|invalid|example)$/.test(h)) return null;
    if (h === "localhost" || h.endsWith(".localhost")) return null;
    u.hash = "";
    return u.href;
  } catch { return null; }
}
export const cleanWebText = (text: string) => text.replace(/^L\d+:\s?/gm, "").replace(/\\\|/g,"|").trim();
export function collectWebSources(message: unknown, references:{name:string;url:string}[]=[]): WebProductSource[] {
  const tools = z.object({executed_tools:z.array(z.unknown())}).safeParse(message);
  if (!tools.success) return [];
  const found = new Map<string,WebProductSource>();
  // Deliberately ignore assistant message.content: names and URLs must come from tool metadata.
  for (const raw of tools.data.executed_tools.slice(0,20)) {
    const tool = z.object({search_results:z.object({results:z.array(z.object({title:z.string(),url:z.string(),content:z.string().optional()}))}).optional(),output:z.string().optional()}).safeParse(raw);
    if (!tool.success) continue;
    for (const r of tool.data.search_results?.results.slice(0,15) || []) {
      const url=safePublicWebUrl(r.url);
      if (url && !found.has(url)) found.set(url,{title:r.title.trim().slice(0,240),url,host:new URL(url).hostname,page_text:"",opened:false});
    }
  }
  for (const raw of tools.data.executed_tools.slice(0,20)) {
    const tool=z.object({name:z.string().optional(),output:z.string()}).safeParse(raw);
    if (!tool.success || tool.data.name !== "browser.open") continue;
    const text=cleanWebText(tool.data.output);
    const url=safePublicWebUrl(text.match(/(?:^|\n)URL:\s*\n?(https:\/\/\S+)/)?.[1]);
    // Opened pages bind to search metadata or explicit public catalog retrieval leads.
    let record=url ? found.get(url) : undefined;
    // Explicit public catalog leads may be opened directly; preserve the actual opened URL.
    if(url&&!record){const opened=new URL(url);const lead=references.find(r=>{const ref=safePublicWebUrl(r.url);if(!ref)return false;const u=new URL(ref);return u.origin===opened.origin&&u.pathname===opened.pathname;});if(lead){record={title:lead.name,url,host:opened.hostname,page_text:"",opened:false};found.set(url,record);}}
    if(record && text.length>80){record.opened=true;record.page_text=text.slice(0,60000);}
  }
  return [...found.values()].filter(r=>r.title && !/\.(?:pdf|jpg|jpeg|png|zip)(?:$|\?)/i.test(r.url)).sort((a,b)=>Number(b.opened)-Number(a.opened)).slice(0,6);
}
// Preserve source-backed evidence beyond navigation/marketing prefixes within a bounded model input.
export function evidenceExcerpt(text:string, budget=5000):string {
  if(text.length<=budget)return text;
  const ranges:{start:number;end:number}[]=[];
  const add=(start:number,end:number)=>{ranges.push({start:Math.max(0,start),end:Math.min(text.length,end)});};
  // Suitability first: this is a required eligibility fact, not inferred from moisturizing ingredients.
  for(const m of text.matchAll(/suitable for|(?:for|ideal for|recommended for) (?:normal|dry|oily|combination|sensitive)|all skin types|not recommended|not suitable/gi)){
    add(m.index-140,m.index+460);if(ranges.length>=4)break;
  }
  const formula=/(?:ingredients|\binci\b)\s*[:\-]/i.exec(text);
  if(formula)add(formula.index-50,formula.index+2200);
  for(const pattern of [/(?:₹|INR|Rs\.)\s*[\d,]+/i,/fragrance[ -]?free|non[ -]?comedogenic|\bvegan\b/i]){
    const m=pattern.exec(text);if(m)add(m.index-100,m.index+350);
  }
  add(0,650);
  // Keep independent original spans; never manufacture a quote by joining distant sentences.
  let remaining=budget;const selected:{start:number;end:number}[]=[];
  for(const r of ranges){if(selected.some(s=>r.start>=s.start&&r.end<=s.end))continue;const end=Math.min(r.end,r.start+remaining);if(end>r.start){selected.push({start:r.start,end});remaining-=end-r.start+25;}if(remaining<=0)break;}
  return selected.sort((a,b)=>a.start-b.start).map(r=>text.slice(r.start,r.end)).join("\n[separate source span]\n");
}
export const sourceQuotesSchema=z.object({pages:z.array(z.object({
  index:z.number().int().min(0).max(5),
  price_quote:z.string().max(220).nullable(),
  ingredients_quote:z.string().max(650).nullable(),
  suitability_quote:z.string().max(300).nullable(),
  full_inci_quote:z.string().max(4500).nullable().default(null),
  claims_quote:z.string().max(350).nullable().default(null),
}).strict()).max(6)}).strict();
function provenQuote(value:string|null|undefined, source:WebProductSource) {
  if(!source.opened || !value) return null;
  const normalize=(s:string)=>s.replace(/\s+/g," ").trim();
  const quote=normalize(value);
  return quote.length>=5 && normalize(source.page_text).includes(quote) ? quote : null;
}
export function buildWebResults(sources:WebProductSource[], quotes:unknown):WebProductResult[] {
  const parsed=sourceQuotesSchema.safeParse(quotes);
  return sources.map((s,index)=>{
    const q=parsed.success ? parsed.data.pages.find(p=>p.index===index) : undefined;
    const full=provenQuote(q?.full_inci_quote,s);
    const fullList=full && /(?:ingredients|\binci\b)\s*[:\-]/i.test(full) && full.split(/[,;]/).length>=4 ? full : null;
    return {title:s.title,url:s.url,host:s.host,page_opened:s.opened,
      price_quote:q?.price_quote && /(?:₹|\bINR\b|\bRs\.?)[\s\S]*\d/i.test(q.price_quote) ? provenQuote(q.price_quote,s) : null,ingredients_quote:provenQuote(q?.ingredients_quote,s),suitability_quote:provenQuote(q?.suitability_quote,s),full_inci_quote:fullList,claims_quote:provenQuote(q?.claims_quote,s)};
  });
}
