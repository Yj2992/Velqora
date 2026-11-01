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
export type WebProductSearch = { source: "groq-web"; model: string; searched_at: string; results: WebProductResult[] };
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
export function collectWebSources(message: unknown): WebProductSource[] {
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
    // An opened page counts only when its URL was also returned by a search tool.
    const record=url ? found.get(url) : undefined;
    if(record && text.length>80){record.opened=true;record.page_text=text.slice(0,12000);}
  }
  return [...found.values()].filter(r=>r.title && !/\.(?:pdf|jpg|jpeg|png|zip)(?:$|\?)/i.test(r.url)).sort((a,b)=>Number(b.opened)-Number(a.opened)).slice(0,6);
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
