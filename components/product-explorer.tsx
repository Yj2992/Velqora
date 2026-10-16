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
} from "lucide-react";
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
import ingredients from "@/data/ingredients.catalog.json";
const label = (id: string) =>
  ingredients.find((i) => i.id === id)?.name || id.replaceAll("_", " ");
const money = (amount: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount);
export function ProductExplorer({ products }: { products: Product[] }) {
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
    [expanded, setExpanded] = useState<string | null>(null),
    [visible, setVisible] = useState(12),
    [status, setStatus] = useState(""),
    [saving, setSaving] = useState(false),
    [ready, setReady] = useState(false),
    [avoid, setAvoid] = useState("");
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
  const { matches, showingBasicCare } = useMemo(() => {
    const result = discoverProducts(
      products,
      effective,
      focus,
      Date.now(),
      browse,
      (m) =>
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
            Real products. Published ingredients. Matches explained by fixed
            rules, with room for what your skin tells you.
          </p>
          <div className="product-hero-pills">
            <span>
              <ShieldCheck size={15} /> Source-checked in India
            </span>
            <span>
              <Leaf size={15} /> No generative AI
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
      <div className="product-layout">
        <aside className="product-sidebar card">
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
          <section className="card product-focus">
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
              onClick={() => setBrowse(false)}
            >
              My product matches
            </button>
            <button
              className={browse ? "active" : ""}
              onClick={() => setBrowse(true)}
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
                  {c.replaceAll("_", " ")}
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
              {matches.slice(0, visible).map((match) => {
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
                      <span className="section-label">{p.brand}</span>
                      <h3>{p.name}</h3>
                      <div className="product-price">
                        <strong>{money(p.price_inr)}</strong>
                        <span>{p.pack_size}</span>
                      </div>
                      <div className="ingredient-tags">
                        {p.ingredient_ids
                          .filter(
                            (i) => i !== "fragrance" && i !== "alcohol_denat",
                          )
                          .slice(0, 4)
                          .map((i) => (
                            <span key={i}>{label(i)}</span>
                          ))}
                      </div>
                      <div className="product-reason">
                        <ShieldCheck size={15} />
                        <p>
                          {browse
                            ? "Browse record — not a personalized efficacy claim."
                            : match.reasons[0]}
                        </p>
                      </div>
                      <small>
                        Brand-listed skin types:{" "}
                        {p.skin_types.length
                          ? p.skin_types.join(", ")
                          : "not verified"}
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
          {visible < matches.length && (
            <div className="load-products">
              <Button
                variant="secondary"
                onClick={() => setVisible((n) => n + 12)}
              >
                Show more products
              </Button>
            </div>
          )}
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
