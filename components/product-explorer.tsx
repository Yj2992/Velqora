"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Search,
  SlidersHorizontal,
  ShieldCheck,
  FlaskConical,
  Check,
  Leaf,
  BookOpen,
  ShoppingBag,
  Sparkles,
  ArrowRight,
  X,
  Columns3,
  Globe,
} from "lucide-react";
import { isQuotaError } from "@/lib/client/api-error";
import { useApp, api } from "./app-provider";
import { Button } from "./ui/button";
import { discoverProducts, explainMatches } from "@/lib/products/empty-state";
import { relativeFocus, scanSkinType } from "@/lib/products/engine";
import {
  concernRules,
  scoreInterpretation,
  type ConcernId,
} from "@/lib/products/rules";
import {
  defaultPreferences,
  categories,
  skinTypes,
  type Preferences,
  type Product,
} from "@/lib/products/types";
import {
  starterShortlist,
  featuredIngredients,
  categoryNames,
} from "@/lib/products/presentation";
import { productIntentSchema, mergeSearchPreferences, matchesSearchIntent, describeIntent, type ProductIntent } from "@/lib/products/search-intent";
import { ScanProductResults } from "./scan-product-results";
import { assessScanProducts, buildScanDiscoveryPlan, type ScanProductDiscovery } from "@/lib/products/scan-discovery";
import type { DiscoveryFilters } from "@/lib/products/discovery-filters";
import type { WebProductSearch } from "@/lib/products/web-results";
import ingredients from "@/data/ingredients.catalog.json";
const label = (id: string) =>
  ingredients.find((i) => i.id === id)?.name || id.replaceAll("_", " ");
const money = (amount: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount);
export function ProductExplorer({ products, aiSearchAvailable = false }: { products: Product[]; aiSearchAvailable?: boolean }) {
  const { data, demo } = useApp();
  const scans = data.scans
    .filter((s) => s.status === "completed")
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  const [prefs, setPrefs] = useState<Preferences>(defaultPreferences),
    [scanId, setScanId] = useState(""),
    [focus, setFocus] = useState<ConcernId[]>([]),
    [manual, setManual] = useState(false),
    [browse, setBrowse] = useState(false),
    [query, setQuery] = useState(""),
    [brand, setBrand] = useState(""),
    [category, setCategory] = useState(""),
    [sort, setSort] = useState("matches"),
    [listView, setListView] = useState("shortlist"),
    [completeOnly, setCompleteOnly] = useState(false),
    [expanded, setExpanded] = useState<string | null>(null),
    [visible, setVisible] = useState(12),
    [status, setStatus] = useState(""),
    [saving, setSaving] = useState(false),
    [ready, setReady] = useState(false),
    [avoid, setAvoid] = useState("");
  const [aiQuery, setAiQuery] = useState(""), [aiBusy, setAiBusy] = useState(false), [aiError, setAiError] = useState("");
  const [proposal, setProposal] = useState<ProductIntent | null>(null), [aiIntent, setAiIntent] = useState<ProductIntent | null>(null);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [searchScope, setSearchScope] = useState<"scan" | "web" | "catalog">("scan"), [webConsent, setWebConsent] = useState(false);
  const [webResults, setWebResults] = useState<WebProductSearch | null>(null);
  const [webRequest, setWebRequest] = useState("");
  const [scanDiscovery,setScanDiscovery] = useState<ScanProductDiscovery|null>(null), [scanResultKey,setScanResultKey] = useState("");
  const [searchPaused,setSearchPaused]=useState(false);
  function handleSearchError(error:unknown){if(isQuotaError(error)){setSearchPaused(true);setAiError("");}else setAiError(error instanceof Error?error.message:"Search could not be completed.");}
  const aiAllowed = !demo && data.llmConsent && aiSearchAvailable;
  async function searchWithGroq() {
    if (!aiAllowed || searchPaused || aiBusy || !ready) return;
    if (searchScope !== "scan" && aiQuery.trim().length < 5) return;
    if ((searchScope === "web" || searchScope === "scan") && !webConsent) return;
    if (searchScope === "scan" && !scanPlan) return;
    setAiBusy(true); setAiError(""); setProposal(null);
    if (searchScope === "scan") {
      setWebResults(null);
      const key=currentScanRequestKey;
      try {
        const result=await api<ScanProductDiscovery>("/api/products/discover",{method:"POST",body:JSON.stringify({mode:"scan",scan_id:scanId,preferences:{...prefs,avoid_ingredients:avoid.split(",").map(s=>s.trim()).filter(Boolean)},filters:sharedFilters,web_consent:true})});
        setScanResultKey(key);setScanDiscovery(result);
      } catch(e){handleSearchError(e);}
      finally {setAiBusy(false);}
      return;
    }
    if (searchScope === "web") {
      const requestText=aiQuery.trim();
      try {setWebResults(await api<WebProductSearch>("/api/products/discover",{method:"POST",body:JSON.stringify({question:requestText,web_consent:true})}));setWebRequest(requestText);}
      catch(e){handleSearchError(e);}
      finally {setAiBusy(false);}
      return;
    }
    try {
      const result = await api<{intent: ProductIntent}>("/api/products/search", {method:"POST",body:JSON.stringify({question:aiQuery.trim()})});
      setProposal(productIntentSchema.parse(result.intent));
    } catch(e) {handleSearchError(e);}
    finally {setAiBusy(false);}
  }
  function applyProposal() {
    if (!proposal || proposal.unresolved_terms.length) return;
    try {
      const next = mergeSearchPreferences({...prefs,avoid_ingredients:avoid.split(",").map(s=>s.trim()).filter(Boolean)},proposal);
      setPrefs(next); setAvoid(next.avoid_ingredients.join(", "));
      setAiIntent(proposal); setManual(true); setFocus(proposal.concerns as ConcernId[]);
      setBrowse(!proposal.concerns.length); setQuery(""); setBrand(""); setCategory(""); setSort("matches");
      setProposal(null); setStatus("Groq search filters applied for this visit. Your stricter preferences remain. Nothing was saved to your profile.");
    } catch {setAiError("These filters exceed the ingredient-exclusion limit. Review your exclusions manually; none were removed.");}
  }
  const selected = scans.find((s) => s.id === scanId);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setScanId(
      scans.find((s) => s.id === params.get("scan"))?.id || scans[0]?.id || "",
    );
    let stopped = false;
    const load = demo
      ? Promise.resolve(defaultPreferences)
      : api<Preferences>("/api/product-preferences");
    void load
      .then((p) => {
        if (!stopped) {
          setPrefs(p);
          setAvoid(p.avoid_ingredients.join(", "));
        }
      })
      .catch((e) => {
        if (!stopped) setStatus((e as Error).message);
      })
      .finally(() => {
        if (!stopped) setReady(true);
      });
    return () => {
      stopped = true;
    };
    // The app shell mounts children after account loading; scan selection then remains user-controlled.
  }, [demo]);
  useEffect(() => {
    if (!manual) setFocus(relativeFocus(selected).map((x) => x.id));
  }, [scanId, manual]);
  const effective = {
    ...prefs,
    skin_type:
      prefs.skin_type === "unknown" ? scanSkinType(selected) : prefs.skin_type,
    avoid_ingredients: avoid
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean),
  };
  const sharedFilters:DiscoveryFilters={concerns:manual?focus:null,category:category as DiscoveryFilters["category"],brand:products.find(p=>p.brand_slug===brand)?.brand||"",query:query.trim().slice(0,200),full_ingredients_only:completeOnly,sort:sort as DiscoveryFilters["sort"],list_view:listView as DiscoveryFilters["list_view"]};
  const currentScanRequestKey=JSON.stringify({scanId,prefs,avoid,filters:{...sharedFilters,sort:undefined,list_view:undefined}});
  const scanPlan=useMemo(()=>{
    if(!selected)return null;
    try{return buildScanDiscoveryPlan(selected,{...prefs,avoid_ingredients:avoid.split(",").map(s=>s.trim()).filter(Boolean)},sharedFilters);}catch{return null;}
  },[selected,prefs,avoid,manual,focus,category,brand,query,completeOnly,sort,listView]);
  useEffect(()=>{setWebConsent(false);},[scanId,prefs,avoid,manual,focus,category,brand,query,completeOnly]);
  const activeScanDiscovery=scanDiscovery && scanDiscovery.scan_id===scanId && scanPlan ? {...scanDiscovery,plan:scanPlan,...assessScanProducts(scanDiscovery.results,scanPlan,{...prefs,avoid_ingredients:effective.avoid_ingredients},sharedFilters)} : null;
  const { matches, showingBasicCare } = useMemo(() => {
    const result = discoverProducts(
      products,
      effective,
      focus,
      Date.now(),
      browse,
      (m) =>
        matchesSearchIntent(m.product, aiIntent) &&
        (!completeOnly || m.product.inci_complete) &&
        (!brand || m.product.brand_slug === brand) &&
        (!category || m.product.category === category) &&
        (!query ||
          [
            m.product.name,
            m.product.brand,
            ...m.product.ingredient_ids.map(label),
          ]
            .join(" ")
            .toLowerCase()
            .includes(query.toLowerCase())),
    );
    const found = result.matches;
    if (sort === "price-low")
      found.sort((a, b) => a.product.price_inr - b.product.price_inr);
    if (sort === "price-high")
      found.sort((a, b) => b.product.price_inr - a.product.price_inr);
    return { ...result, matches: found };
  }, [
    products,
    aiIntent,
    completeOnly,
    prefs,
    avoid,
    scanId,
    focus,
    browse,
    brand,
    category,
    query,
    sort,
  ]);
  const shortlist = useMemo(() => starterShortlist(matches), [matches]);
  const displayMatches =
    listView === "shortlist" && sort === "matches" ? shortlist : matches;
  const emptyDetails =
    !browse && !matches.length
      ? explainMatches(products, effective, focus)
      : null;
  useEffect(
    () => setVisible(12),
    [query, brand, category, sort, focus, prefs, browse, avoid, scanId],
  );
  async function save() {
    setSaving(true);
    setStatus("");
    try {
      if (demo)
        setStatus(
          "Demo preferences apply to this visit only. No private profile was saved.",
        );
      else {
        await api("/api/product-preferences", {
          method: "PUT",
          body: JSON.stringify(effective),
        });
        setStatus("Your product preferences were saved.");
      }
    } catch (e) {
      setStatus((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  const brands = [
    ...new Map(products.map((p) => [p.brand_slug, p.brand])).entries(),
  ].sort((a, b) => a[1].localeCompare(b[1]));
  const toggle = (key: keyof Preferences, value: unknown) =>
    setPrefs((p) => ({ ...p, [key]: value }));
  return (
    <>
      <section className="product-hero">
        <div>
          <span className="eyebrow">CONSIDERED CARE. CLEAR SOURCES.</span>
          <h1>
            A little science.
            <br />A more considered shelf.
          </h1>
          <p>
            Real products. Published ingredients. Let your scan and preferences guide a considered starting routine, with source-supported product choices from across the web.
          </p>
          <div className="product-hero-pills">
            <span>
              <ShieldCheck size={15} /> Source-checked in India
            </span>
            <span>
              <Sparkles size={15} /> Live web discovery + verified catalog
            </span>
          </div>
        </div>
        <div className="catalog-seal">
          <ShoppingBag size={32} strokeWidth={1} />
          <strong>{products.length}</strong>
          <span>verified catalog records</span>
          <small>{brands.length} official brand stores · INR</small>
        </div>
      </section>
      {demo && (
        <div className="notice">
          The products are real. Personalization here uses synthetic demo scans;
          it is not a personal skin assessment.
        </div>
      )}
      <section className="product-ai-search" aria-labelledby="product-ai-heading">
        <div className="product-discovery-tabs" role="group" aria-label="Where to search"><button disabled={aiBusy} aria-pressed={searchScope === "scan"} onClick={()=>{setSearchScope("scan");setProposal(null);setAiError("");setWebConsent(false);}}>For my scan</button><button disabled={aiBusy} aria-pressed={searchScope === "web"} onClick={()=>{setSearchScope("web");setProposal(null);setAiError("");}}><Globe size={16}/>Across the web</button><button disabled={aiBusy} aria-pressed={searchScope === "catalog"} onClick={()=>{setSearchScope("catalog");setAiError("");}}><ShieldCheck size={16}/>Verified catalog</button></div>
        <div className="product-ai-intro"><span className="section-label"><Sparkles size={14}/> A MORE PERSONAL WAY TO SEARCH</span><h2 id="product-ai-heading">{searchScope === "scan" ? "Your scan. Your next considered step." : "Tell us what belongs on your shelf."}</h2><p>{searchScope === "scan" ? "We turn your selected scan and preferences into a search brief, find products across the web, and check the retrieved ingredient and suitability statements. No shopping prompt needed." : searchScope === "web" ? "Discover brands and product pages beyond our catalog. Groq searches the live web for India-focused sources and opens relevant pages." : "Describe a budget, category or ingredient preference. Groq turns your words into filters; verified catalog facts and fixed rules decide what appears."}</p></div>
        {searchScope === "scan" && <div className="scan-discovery-plan"><label className="field">Use this completed scan<select disabled={aiBusy} aria-label="Scan for personalized product discovery" value={scanId} onChange={e=>{setScanId(e.target.value);setManual(false);setAiError("");}}><option value="">Choose a completed scan</option>{scans.map(s=><option key={s.id} value={s.id}>{new Date(s.created_at).toLocaleDateString("en-IN")} · {s.overall_score?.toFixed(1) ?? "—"}</option>)}</select></label>{scanPlan ? <><div className="scan-plan-type"><strong>{scanPlan.skin_type === "unknown" ? "Skin type not recorded" : scanPlan.skin_type+" skin"}</strong><span>From your scan or explicit skin-type preference · change preferences below</span></div><p className="scan-plan-preferences">Budget: {prefs.budget_inr === null ? "not set" : money(prefs.budget_inr)+" per product"} · Ingredient exclusions: {avoid || "none specified"} · {prefs.adult_confirmed ? "Adult age self-confirmed" : "Adult age not confirmed"}{prefs.fragrance_free ? " · Fragrance-free required" : ""}{prefs.vegan ? " · Vegan required" : ""}</p><a className="text-link" href="#product-preferences">Edit budget and ingredient preferences ↓</a><div className="scan-plan-targets">{scanPlan.targets.map(t=><div key={t.id}><span className="section-label">SELECTED CARE FOCUS</span><h3>{t.label}</h3><p>{t.reason}</p></div>)}</div><p className="subtle">Lower relative scores are prompts for consideration, not diagnoses or severity grades. Gentle cleanser, moisturizer and sun protection form the everyday-care starting point. Your skin-age estimate is never used as your age.</p>{scanPlan.guidance.map(g=><div className="scan-plan-guidance" key={g.label}><strong>{g.label} · guidance</strong><p>{g.text}</p><a className="text-link" href={g.source} target="_blank" rel="noopener noreferrer">Read the evidence ↗</a></div>)}<p className="scan-filter-navigation"><a className="text-link" href="#product-concern-filters">Choose concerns, brand, category and ingredient coverage ↓</a></p><details className="scan-shared-brief"><summary>See the derived brief shared with search providers</summary><p>{scanPlan.search_brief}</p></details></> : <p className="notice">{demo ? "This demo uses synthetic scans with no verified score interpretation. Sign in and select a real completed YouCam scan to use automatic discovery." : "Choose a completed YouCam scan with supported score interpretation to create your personal product brief."}</p>}</div>}
        {searchScope !== "scan" && <form onSubmit={e=>{e.preventDefault();void searchWithGroq();}}>
          <label className="product-ai-input"><Search size={20}/><textarea disabled={aiBusy} aria-label="Describe products to find with Groq" value={aiQuery} onChange={e=>{setAiQuery(e.target.value);setWebConsent(false);setProposal(null);setAiError("");}} placeholder="A fragrance-free moisturizer under ₹500 for dry skin…" minLength={5} maxLength={1000} rows={2} required/><Button disabled={!aiAllowed || searchPaused || aiBusy || aiQuery.trim().length < 5 || (searchScope === "web" && !webConsent)}>{aiBusy ? searchScope === "web" ? "Searching the web…" : "Understanding…" : searchScope === "web" ? "Search across the web" : "Search verified catalog"}<ArrowRight size={16}/></Button></label>
        </form>}
        {(searchScope === "web" || searchScope === "scan") && <label className="checkbox-row product-web-consent"><input type="checkbox" checked={webConsent} disabled={aiBusy} onChange={e=>setWebConsent(e.target.checked)}/><span>{searchScope === "scan" ? "Use Groq + Exa search with my derived skin type, cosmetic care targets and the preferences shown below. No photo, raw scores, scan ID, skin-age estimate or account details are shared." : "Use Groq + its Exa-powered browser search for this request. Only my typed request is shared; no scans or saved profile data."}</span></label>}
        {searchScope === "scan" && <Button className="scan-find-products" disabled={!aiAllowed || searchPaused || !ready || aiBusy || !webConsent || !scanPlan} onClick={()=>void searchWithGroq()}>{aiBusy ? "Finding products for your scan…" : "Find products for my scan"}<ArrowRight size={16}/></Button>}
        {searchScope !== "scan" && <div className="product-ai-examples">{["A moisturizer under ₹500 for dry skin", "A cleanser under ₹400, without niacinamide", "A vegan sunscreen under ₹700"].map(q=><button disabled={aiBusy} key={q} onClick={()=>{setAiQuery(q);setWebConsent(false);setProposal(null);setAiError("");}}>{q}<ArrowUpRight size={12}/></button>)}</div>}
        <p className="product-ai-disclosure">{demo ? "Synthetic demo: Groq is not called. Use the catalog filters below, or sign in to try AI search." : !data.llmConsent ? <>External AI sharing is off. <Link href="/settings#ai-sharing">Enable it in Settings →</Link></> : !aiSearchAvailable ? "Groq search is not configured on this server. Catalog filters still work." : "Your selected search mode determines the information shared, as shown above. Photos, skin-age estimates and account details are not shared. Free-tier quotas apply."} {searchScope === "scan" ? "Results are checked against retrieved source statements and your selected preferences. Missing facts do not count as satisfied. Ingredient excerpts alone cannot clear an exclusion that requires a complete formula." : searchScope === "web" ? "Web results are source discoveries, not fully verified suitability matches. Catalog preferences are not automatically applied to them. Check the exact pack, ingredients and price with the seller." : "Catalog search does not browse the web or verify live prices."}</p>
        {searchPaused && <div className="notice" role="status"><strong>Live search is paused. Catalog matching still works.</strong><p>The free search quota has been reached. Your scan priorities, preferences and ingredient filters still apply to the catalog below. No automatic retries are running. The provider has not supplied a confirmed reset time.</p><a className="text-link" href="#product-catalog-results">See catalog matches ↓</a><button className="text-link" style={{marginLeft:"1rem"}} onClick={()=>{setSearchPaused(false);setAiError("");}}>Enable another search attempt</button></div>}
        {aiError && <div className="error" role="alert">{aiError}</div>}
        {aiBusy && (searchScope === "web" || searchScope === "scan") && <div className="product-web-loading" role="status"><span className="loader small-loader"/><div><strong>Looking beyond the catalog.</strong><p>Searching product pages and checking source excerpts. This can take up to a minute.</p></div></div>}
        {proposal && searchScope === "catalog" && <div className="product-ai-review" role="status"><div className="card-heading"><div><span className="section-label">REVIEW BEFORE APPLYING</span><h3>Here’s how we understood your request.</h3></div><button aria-label="Dismiss proposed filters" onClick={()=>setProposal(null)}><X size={17}/></button></div><div className="product-ai-tags">{describeIntent(proposal).map((t,i)=><span key={i}>{t}</span>)}</div>{proposal.unresolved_terms.length > 0 ? <p className="notice">We cannot verify or represent these requirements: {proposal.unresolved_terms.join("; ")}. Edit your request or use the manual filters. These requirements have not been satisfied.</p> : !describeIntent(proposal).length ? <p>No specific filters were recognized. Try adding a category or budget.</p> : <><p>Existing ingredient exclusions, stricter budgets, age confirmation and retinoid choices stay in place. Applying replaces the text, brand and category search, and selects these concerns. Your profile is not saved automatically.</p><Button onClick={applyProposal}>Apply reviewed filters <Check size={15}/></Button></>}</div>}
      </section>
      {searchScope !== "scan" && webResults && <section className="product-web-results" aria-labelledby="web-results-heading"><div className="card-heading"><div><span className="section-label">LIVE WEB DISCOVERY · INDIA</span><h2 id="web-results-heading">A wider shelf to explore.</h2><p>For “{webRequest}” · Searched {new Date(webResults.searched_at).toLocaleString("en-IN")}</p></div><button className="text-link" onClick={()=>setWebResults(null)}>Dismiss results <X size={14}/></button></div><p className="product-web-note">These sources are outside the verified catalog. Titles and links come from search-tool results; detail excerpts are checked against retrieved page text. Search results may include collection pages. Price, availability, full ingredients and suitability require your review. No match percentage or treatment claim is inferred.</p><div className="product-web-grid">{webResults.results.map(r=><article className="card product-web-card" key={r.url}><div className="product-web-source"><Globe size={18}/><span>{r.host}</span><small>{r.page_opened ? "Page opened" : "Search result"}</small></div><h3>{r.title}</h3><dl><div><dt>Price excerpt</dt><dd>{r.price_quote || "Price / exact pack not verified"}</dd></div><div><dt>Ingredients excerpt</dt><dd>{r.ingredients_quote || "Full ingredient information not verified"}</dd></div><div><dt>Suitability excerpt</dt><dd>{r.suitability_quote || "Skin suitability not verified"}</dd></div></dl><p className="subtle">Page statements are seller claims. Read the source and the received pack before choosing.</p><div className="product-web-actions"><Button asChild><a href={r.url} target="_blank" rel="noopener noreferrer">Open source <ArrowUpRight size={14}/></a></Button><Button asChild variant="secondary"><Link href={"/experiments/new?custom_name="+encodeURIComponent(r.title)+"&source="+encodeURIComponent(r.url)}>Track as custom product <FlaskConical size={14}/></Link></Button></div></article>)}</div><p className="product-web-note">Want checked ingredient exclusions and transparent eligibility? Use the verified catalog below. Web discoveries are never silently added to it.</p></section>}
      <div className="product-catalog-heading"><div><span className="section-label">ONE SET OF FILTERS</span><h2>Your priorities. Your product choices.</h2></div><span>Applies to scan discovery and catalog matches</span></div>
      <nav className="product-category-rail" aria-label="Shop by category"><button aria-pressed={!category} onClick={()=>{setCategory("");}}>All categories</button>{categories.map(c=><button key={c} aria-pressed={category === c} onClick={()=>{setCategory(c);}}>{categoryNames[c]}</button>)}</nav>
      {aiIntent && <div className="product-ai-applied"><div><span className="section-label">GROQ-INTERPRETED SEARCH</span><div className="product-ai-tags">{describeIntent(aiIntent).map((t,i)=><span key={i}>{t}</span>)}</div><p>Products and explanations below come from catalog facts and rules, not generated recommendations. Any stricter preferences still apply.</p></div><button className="text-link" onClick={()=>setAiIntent(null)}>Remove AI search constraints <X size={13}/></button></div>}
      {compareIds.length > 0 && <section id="product-comparison" className="product-compare card" aria-label="Compare selected products"><div className="card-heading"><div><span className="section-label">SIDE BY SIDE</span><h2>Compare the details that matter.</h2></div><button className="text-link" onClick={()=>setCompareIds([])}>Clear comparison <X size={14}/></button></div><p>Catalog facts only. Comparison does not override your eligibility filters or establish effectiveness.</p><div className="product-compare-scroll"><table><caption className="sr-only">Selected product facts</caption><thead><tr><th scope="col">Published details</th>{products.filter(p=>compareIds.includes(p.id)).map(p=><th scope="col" key={p.id}>{p.name}<button aria-label={"Remove "+p.name+" from comparison"} onClick={()=>setCompareIds(ids=>ids.filter(id=>id!==p.id))}><X size={14}/></button></th>)}</tr></thead><tbody>{["Brand","Pack price","Pack size","Category","Key ingredients","Brand-listed skin types","Ingredient coverage","Last verified","Source"].map((row,i)=><tr key={row}><th scope="row">{row}</th>{products.filter(p=>compareIds.includes(p.id)).map(p=><td key={p.id}>{i===0?p.brand:i===1?money(p.price_inr):i===2?p.pack_size:i===3?categoryNames[p.category]:i===4?p.ingredient_ids.map(label).join(", ")||"Not verified":i===5?p.skin_types.join(", ")||"Not verified":i===6?p.inci_complete?"Full INCI captured":"Key ingredients only":i===7?new Date(p.verified_at).toLocaleDateString("en-IN"):<a className="text-link" href={p.source_url} target="_blank" rel="noopener noreferrer">Official source ↗</a>}</td>)}</tr>)}</tbody></table></div></section>}
      {compareIds.length > 0 && <a className="product-compare-floating" href="#product-comparison"><Columns3 size={16}/>{compareIds.length} of 3 selected · View comparison <ArrowUpRight size={15}/></a>}
      <div className="product-layout">
        <aside id="product-preferences" className="product-sidebar card">
          <div className="card-heading">
            <h2>
              <SlidersHorizontal size={18} /> Make it yours
            </h2>
          </div>
          <label className="field">
            Use a completed scan
            <select
              value={scanId}
              onChange={(e) => {
                setScanId(e.target.value);
                setManual(false);
              }}
            >
              <option value="">No scan · choose concerns</option>
              {scans.map((s) => (
                <option key={s.id} value={s.id}>
                  {new Date(s.created_at).toLocaleDateString("en-IN")} ·{" "}
                  {s.overall_score == null ? "—" : s.overall_score.toFixed(1)}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Skin type
            <select
              value={prefs.skin_type}
              onChange={(e) => toggle("skin_type", e.target.value)}
            >
              <option value="unknown">
                {scanSkinType(selected) !== "unknown"
                  ? `Use scan: ${scanSkinType(selected)}`
                  : "Not specified"}
              </option>
              {skinTypes.map((t) => (
                <option key={t} value={t}>
                  {t[0].toUpperCase() + t.slice(1)}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Budget per product (₹)
            <input
              type="number"
              min={50}
              max={100000}
              placeholder="No limit"
              value={prefs.budget_inr ?? ""}
              onChange={(e) =>
                toggle(
                  "budget_inr",
                  e.target.value ? Number(e.target.value) : null,
                )
              }
            />
          </label>
          <label className="field">
            Ingredients to avoid
            <input
              value={avoid}
              onChange={(e) => setAvoid(e.target.value)}
              maxLength={500}
              placeholder="e.g. niacinamide, fragrance"
            />
            <small>
              Comma-separated. Incomplete ingredient lists are excluded when
              this is set. This is not an allergy-safety guarantee.
            </small>
          </label>
          {(
            [
              ["fragrance_free", "Brand states fragrance-free"],
              ["non_comedogenic", "Brand states non-comedogenic"],
              ["vegan", "Brand states vegan"],
              ["sensitive", "Conservative sensitive-skin filter"],
              ["avoid_retinoids", "Avoid retinoids"],
              ["adult_confirmed", "I am 18+ (allow active-ingredient matches)"],
            ] as const
          ).map(([key, text]) => (
            <label className="checkbox-row product-checkbox" key={key}>
              <input
                type="checkbox"
                checked={prefs[key]}
                onChange={(e) => toggle(key, e.target.checked)}
              />
              <span>{text}</span>
            </label>
          ))}
          <p className="subtle">
            Retinoids stay excluded unless you opt out of avoidance and confirm
            you are 18+. Do not use retinoids during pregnancy or breastfeeding.
            A scan’s skin-age estimate is never used as your age.
          </p>
          <details className="brand-preferences">
            <summary>Preferred brands</summary>
            {brands.map(([id, name]) => (
              <label className="checkbox-row product-checkbox" key={id}>
                <input
                  type="checkbox"
                  checked={prefs.preferred_brands.includes(id)}
                  onChange={(e) =>
                    toggle(
                      "preferred_brands",
                      e.target.checked
                        ? [...prefs.preferred_brands, id]
                        : prefs.preferred_brands.filter((x) => x !== id),
                    )
                  }
                />
                <span>{name}</span>
              </label>
            ))}
          </details>
          <Button
            className="full"
            variant="secondary"
            disabled={!ready || saving}
            onClick={() => void save()}
          >
            {saving ? "Saving…" : "Save my preferences"}
          </Button>
          {status && (
            <p className="notice" role="status">
              {status}
            </p>
          )}
        </aside>
        <div className="product-main">
          <section id="product-concern-filters" className="card product-focus">
            <div className="card-heading">
              <div>
                <span className="section-label">YOUR STARTING POINT</span>
                <h2>
                  {manual
                    ? "Your selected concerns"
                    : selected &&
                        selected.provider_version ===
                          scoreInterpretation.supportedProvider
                      ? "Relative scan priorities"
                      : "What would you like to explore?"}
                </h2>
              </div>
              {selected && (
                <button className="text-link" onClick={() => setManual(false)}>
                  Use scan priorities
                </button>
              )}
            </div>
            <p>
              {selected &&
              selected.provider_version ===
                scoreInterpretation.supportedProvider
                ? "Lower scores are suggested relative priorities, not a diagnosis or severity grade. Confirm or change what matters to you."
                : selected
                  ? "Automatic priorities are unavailable for this scan’s provider version. Choose your concerns below; no score interpretation has been assumed."
                  : "Choose concerns below, or browse basic care without an inferred concern."}
            </p>
            <div className="concern-chips">
              {concernRules.map((r) => (
                <button
                  key={r.id}
                  className={
                    "concern-chip " + (focus.includes(r.id) ? "selected" : "")
                  }
                  aria-pressed={focus.includes(r.id)}
                  onClick={() => {
                    setManual(true);
                    setFocus((f) =>
                      f.includes(r.id)
                        ? f.filter((x) => x !== r.id)
                        : [...f, r.id],
                    );
                  }}
                >
                  {focus.includes(r.id) && <Check size={13} />} {r.label}
                  {r.support === "not_topical" && (
                    <span title="Topicals cannot reliably correct this concern">
                      {" "}
                      · guidance
                    </span>
                  )}
                </button>
              ))}
            </div>
            {focus.length > 0 && (
              <details className="focus-evidence">
                <summary>
                  Selected concern guidance & evidence ({focus.length})
                </summary>
                {focus
                  .map((id) => concernRules.find((r) => r.id === id)!)
                  .map((r) => (
                    <div className="concern-guidance" key={r.id}>
                      <strong>
                        {r.label}
                        {r.support === "not_topical"
                          ? " · topical correction not supported"
                          : r.support === "limited"
                            ? " · limited cosmetic support"
                            : ""}
                      </strong>
                      <p>{r.limitation}</p>
                      <a
                        className="text-link"
                        href={r.source}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Read the evidence <ArrowUpRight size={13} />
                      </a>
                    </div>
                  ))}
              </details>
            )}
            <details className="score-source">
              <summary>How scan scores are used</summary>
              <p>
                {scoreInterpretation.note} We suggest the three lowest available
                whole-face UI scores for the supported SD provider version.
                Missing, out-of-range and other-version scores are not used. You
                can override every suggestion.
              </p>
              <a
                className="text-link"
                href={scoreInterpretation.source}
                target="_blank"
                rel="noopener noreferrer"
              >
                YouCam score documentation
              </a>
            </details>
          </section>
          <div className="product-mode" role="group" aria-label="Product view">
            <button
              className={!browse ? "active" : ""}
              onClick={() => {setBrowse(false);setSearchScope("scan");}}
            >
              My product matches
            </button>
            <button
              className={browse ? "active" : ""}
              onClick={() => {setBrowse(true);setSearchScope("catalog");}}
            >
              Browse catalog
            </button>
          </div>
          <div className="product-toolbar">
            <label className="product-search">
              <Search size={17} />
              <input
                aria-label="Search products or ingredients"
                placeholder="Search products, brands, ingredients…"
                maxLength={200}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <select
              aria-label="Filter brand"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
            >
              <option value="">All brands</option>
              {brands.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
            <select
              aria-label="Filter category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {categoryNames[c]}
                </option>
              ))}
            </select>
            <select
              aria-label="Sort products"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            >
              <option value="matches">Rule-based order</option>
              <option value="price-low">Price: low to high</option>
              <option value="price-high">Price: high to low</option>
            </select>
          </div>
          <div className="product-list-controls">
            <div
              className="shortlist-switch"
              role="group"
              aria-label="List length"
            >
              <button
                aria-pressed={listView === "shortlist" && sort === "matches"}
                onClick={() => {
                  setListView("shortlist");
                  setSort("matches");
                }}
              >
                Starter shortlist
              </button>
              <button
                aria-pressed={listView === "all" || sort !== "matches"}
                onClick={() => setListView("all")}
              >
                All eligible ({searchScope === "scan" && activeScanDiscovery ? activeScanDiscovery.matches.length : matches.length})
              </button>
            </div>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={completeOnly}
                onChange={(e) => setCompleteOnly(e.target.checked)}
              />
              Full ingredient lists only
            </label>
          </div>
          {searchScope === "scan" && <div className="shared-filter-search"><Button disabled={!aiAllowed || searchPaused || !ready || aiBusy || !webConsent || !scanPlan} onClick={()=>void searchWithGroq()}>{aiBusy ? "Finding products…" : "Find products with these filters"}<ArrowRight size={16}/></Button>{!webConsent && <p className="subtle">Review the search brief and sharing checkbox above before searching. Filtering existing results happens locally.</p>}</div>}
          {searchScope === "scan" && activeScanDiscovery && <>{scanResultKey!==currentScanRequestKey && <p className="notice" role="status">Filters updated. These are eligible results from the last search. Use “Find products for my scan” again to discover more sources under these choices.</p>}{activeScanDiscovery.matches.length>0 ? <ScanProductResults discovery={activeScanDiscovery} listView={listView}/> : <p className="notice" role="status">{matches.length>0 ? `${matches.length} catalog products meet your filters below. ` : ""}No additional web products passed every source check. {activeScanDiscovery.evidence_status === "unavailable" ? "The evidence extractor was unavailable; try web discovery later." : "See the web evidence gaps after the catalog results."}</p>}</>}
          <div id="product-catalog-results" className="catalog-results-label section-label">SOURCE-CHECKED CATALOG MATCHES · SAME FILTERS</div>
          {ready && showingBasicCare && (
            <section
              className="card basic-care-intro"
              aria-label="Basic care alternatives"
            >
              <span className="section-label">EVERYDAY CARE</span>
              <h2>
                Basic care
                {effective.skin_type !== "unknown"
                  ? ` for ${effective.skin_type} skin`
                  : " to explore"}
              </h2>
              <p>
                No targeted products qualify for the selected concerns and
                filters. These cleansers, moisturizers and sunscreens meet your
                current preferences. They are general-care options; they are not
                presented as corrections for tear troughs, dark circles or
                pores.
              </p>
              <p>
                Your scan priorities stay selected. Ingredient exclusions,
                budget and active-ingredient choices remain applied to these
                options. You can still change concerns above.
              </p>
            </section>
          )}
          <div className="product-count">
            <strong>
              {matches.length}{" "}
              {showingBasicCare
                ? "basic-care options · 0 targeted matches"
                : browse
                  ? "catalog products"
                  : "matches"}
            </strong>
            <span>Preferences applied · no sponsored ranking</span>
          </div>
          {ready && matches.length > 0 && (
            <p className="shortlist-explanation">
              {listView === "shortlist" && sort === "matches"
                ? `Showing ${shortlist.length} options balanced across available categories and brands, with everyday formats first and rule order within each format.`
                : "All products that meet your current filters."}{" "}
              Choose alternatives that fit your routine; this is not a list to
              use together.
            </p>
          )}
          {!ready ? (
            <div className="card empty-state" role="status">
              Loading your preferences…
            </div>
          ) : !matches.length ? (
            <div className="card empty-state">
              <BookOpen size={30} />
              <h2>No verified matches under these choices.</h2>
              <p>
                Your scan priorities do not always have a suitable topical
                product. Here is what is limiting this selection.
              </p>
              {aiIntent && <p className="notice">AI search constraints are also applied. Remove them above to explore more products; your ingredient exclusions and safety preferences stay in place.</p>}
              {emptyDetails && (
                <div className="empty-match-details">
                  {emptyDetails.rows.map((row) => (
                    <p key={row.id}>
                      <strong>{row.label}</strong>
                      <br />
                      {row.message}
                    </p>
                  ))}
                  {emptyDetails.activeCandidates > 0 && (
                    <p className="notice">
                      {emptyDetails.activeCandidates} concern matches would
                      become eligible with adult confirmation, while keeping
                      your other preferences. If you are 18+, you can confirm
                      this in “Make it yours.” Retinoid avoidance remains
                      applied; age confirmation is not a suitability assessment.
                    </p>
                  )}
                </div>
              )}
              <p>
                We keep ingredient exclusions and suitability checks in place.
                Basic-care products are a separate browsing option, not a
                treatment for tear troughs, eye bags or other structural
                concerns.
              </p>
              <div className="empty-match-actions">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setBrowse(false);
                    setManual(true);
                    setFocus([]);
                    setCategory("");
                    setBrand("");
                    setQuery("");
                  }}
                >
                  Browse basic care
                  {emptyDetails ? ` (${emptyDetails.basicCare})` : ""}
                </Button>
                {(brand || category || query) && (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setCategory("");
                      setBrand("");
                      setQuery("");
                    }}
                  >
                    Clear search, brand & category
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="product-grid">
              {displayMatches.slice(0, visible).map((match) => {
                const p = match.product;
                const trackMetric =
                  match.matchedConcerns.find((id) =>
                    selected?.skin_scan_metrics.some(
                      (m) =>
                        m.metric_type === id &&
                        m.region === "whole" &&
                        m.ui_score !== null,
                    ),
                  ) ||
                  selected?.skin_scan_metrics.find(
                    (m) => m.region === "whole" && m.ui_score !== null,
                  )?.metric_type ||
                  "moisture";
                const track = `/experiments/new?product=${encodeURIComponent(p.id)}${selected ? `&scan=${selected.id}` : ""}&metric=${encodeURIComponent(trackMetric)}`;
                return (
                  <article className="product-card" key={p.id}>
                    <button className={"product-compare-toggle " + (compareIds.includes(p.id) ? "selected" : "")} aria-pressed={compareIds.includes(p.id)} disabled={compareIds.length >= 3 && !compareIds.includes(p.id)} onClick={()=>setCompareIds(ids=>ids.includes(p.id)?ids.filter(id=>id!==p.id):[...ids,p.id])}><Columns3 size={14}/>{compareIds.includes(p.id)?"Added to comparison":"Compare"}</button>
                    <div className="product-image">
                      {p.image_url ? (
                        <img
                          src={p.image_url}
                          alt={p.name}
                          loading="lazy"
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            e.currentTarget.style.visibility = "hidden";
                          }}
                        />
                      ) : (
                        <ShoppingBag size={48} />
                      )}
                      <span className="product-category">
                        {p.category.replaceAll("_", " ")}
                      </span>
                    </div>
                    <div className="product-card-body">
                      <div className="product-brand-row">
                        <span className="section-label">{p.brand}</span>
                        <span
                          className={
                            "ingredient-status " +
                            (p.inci_complete ? "complete" : "partial")
                          }
                        >
                          {p.inci_complete
                            ? "Full ingredient list"
                            : "Key ingredients only"}
                        </span>
                      </div>
                      <h3>{p.name}</h3>
                      <div className="product-price">
                        <strong>{money(p.price_inr)}</strong>
                        <span>{p.pack_size}</span>
                      </div>
                      <div className="ingredient-tags">
                        {featuredIngredients(match).map((i) => (
                          <span key={i}>{label(i)}</span>
                        ))}
                      </div>
                      <div className="product-reason">
                        <ShieldCheck size={15} />
                        <p>
                          {match.matchedConcerns.length
                            ? `Ingredient matches for ${match.matchedConcerns.map((id) => concernRules.find((r) => r.id === id)?.label.toLowerCase()).join(", ")}.`
                            : effective.skin_type !== "unknown"
                              ? `A ${p.category.replaceAll("_", " ")} option · the brand lists ${effective.skin_type} skin suitability.`
                              : `A ${p.category.replaceAll("_", " ")} option · check the brand’s skin-type guidance.`}
                        </p>
                      </div>
                      <small>
                        {effective.skin_type !== "unknown"
                          ? `Brand-listed for ${effective.skin_type} skin`
                          : `Brand-listed skin types: ${p.skin_types.length ? p.skin_types.join(", ") : "not verified"}`}
                      </small>
                      <small>
                        Price checked{" "}
                        {new Date(p.verified_at).toLocaleDateString("en-IN")} ·{" "}
                        {p.inci_complete
                          ? "Published INCI captured"
                          : "Key ingredients only"}
                      </small>
                      <button
                        className="text-link product-detail-button"
                        aria-expanded={expanded === p.id}
                        onClick={() =>
                          setExpanded(expanded === p.id ? null : p.id)
                        }
                      >
                        Ingredients, match details & sources{" "}
                        <ArrowUpRight size={14} />
                      </button>
                      {expanded === p.id && (
                        <div className="product-details">
                          <h4>Why it appears</h4>
                          {match.reasons.map((r, i) => (
                            <p key={i}>{r}</p>
                          ))}
                          <h4>Ingredient information</h4>
                          <p>
                            {p.inci_text ||
                              p.ingredient_ids.map(label).join(", ")}
                          </p>
                          {!p.inci_complete && (
                            <p>
                              Only named key ingredients were verified. This is
                              not a complete ingredient list.
                            </p>
                          )}
                          <h4>Before choosing</h4>
                          {match.warnings.map((w, i) => (
                            <p key={i}>{w}</p>
                          ))}
                          <p>
                            Manufacturer concern labels:{" "}
                            {p.manufacturer_concerns
                              .map(
                                (id) =>
                                  concernRules.find((r) => r.id === id)
                                    ?.label || id,
                              )
                              .join(", ") || "not verified"}
                            . These are brand claims, not clinical validation.
                          </p>
                          <a
                            className="text-link"
                            href={p.ingredient_source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Ingredient source
                          </a>
                          <a
                            className="text-link"
                            href={p.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Price / product source
                          </a>
                        </div>
                      )}
                      <div className="product-actions">
                        <Button asChild>
                          <a
                            href={p.official_url + `?variant=${p.variant_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Official store <ArrowUpRight size={14} />
                          </a>
                        </Button>
                        <Button asChild variant="secondary">
                          <Link href={track}>
                            <FlaskConical size={15} /> Track This Product
                          </Link>
                        </Button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
          {visible < displayMatches.length && (
            <div className="load-products">
              <Button
                variant="secondary"
                onClick={() => setVisible((n) => n + 12)}
              >
                Show more products
              </Button>
            </div>
          )}
          {searchScope === "scan" && activeScanDiscovery && activeScanDiscovery.matches.length===0 && <ScanProductResults discovery={activeScanDiscovery} listView={listView}/>}
          <div className="product-footnote">
            <ShieldCheck size={20} />
            <p>
              Catalog facts were checked against official Indian brand sources.
              Prices and formulations can change; confirm the exact pack,
              ingredient label and availability at checkout. Records older than
              30 days are excluded from matches until reverified. A rule match
              is not proof of effectiveness, a diagnosis, or an allergy-safety
              guarantee.{" "}
              <a
                className="text-link"
                href="https://www.aad.org/public/everyday-care/skin-care-secrets/prevent-skin-problems/test-skin-care-products"
                target="_blank"
                rel="noopener noreferrer"
              >
                How to test a new product
              </a>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
