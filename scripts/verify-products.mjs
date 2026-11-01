import { createRequire } from "node:module";
import { randomBytes, randomUUID } from "node:crypto";
import process from "node:process";
const require = createRequire(new URL("../package.json", import.meta.url));
const { createClient } = require("@supabase/supabase-js");
const { createServerClient } = require("@supabase/ssr");
process.loadEnvFile(new URL("../.env.local", import.meta.url));
const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
  anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const anon = createClient(url, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const created = [];
let uploaded = false;
const path = `qa-check/${randomUUID()}.png`;
const check = (value, message) => {
  if (!value) throw new Error(message);
  console.log("PASS:", message);
};
const must = (r, name) => {
  if (r.error) throw new Error(name + ": " + r.error.message);
  return r.data;
};
async function fixture() {
  const email = `velqora.qa.${Date.now()}.${randomBytes(3).toString("hex")}@example.com`,
    password = randomBytes(30).toString("base64url");
  const data = must(
    await admin.auth.admin.generateLink({
      type: "signup",
      email,
      password,
      options: { data: { display_name: "Connection check" } },
    }),
    "Generate no-email test signup",
  );
  const record = { id: data.user.id, clients: [] };
  created.push(record);
  const verifier = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  record.clients.push(verifier);
  const verified = must(
    await verifier.auth.verifyOtp({
      type: "signup",
      token_hash: data.properties.hashed_token,
    }),
    "Verify test signup",
  );
  check(Boolean(verified.session), "Signup token can be verified");
  const cookies = new Map();
  const client = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => [...cookies].map(([name, value]) => ({ name, value })),
      setAll: (items) =>
        items.forEach(({ name, value }) => cookies.set(name, value)),
    },
  });
  record.clients.push(client);
  const login = must(
    await client.auth.signInWithPassword({ email, password }),
    "Password sign-in",
  );
  check(
    login.user.id === data.user.id,
    "Password authentication and SSR cookies work",
  );
  return {
    id: data.user.id,
    client,
    cookie: [...cookies].map(([name, value]) => name + "=" + value).join("; "),
  };
}
async function app(session, path, method = "GET", body) {
  const r = await fetch("http://127.0.0.1:3000" + path, {
    method,
    headers: {
      cookie: session.cookie,
      origin: "http://127.0.0.1:3000",
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await r.json();
  if (!r.ok)
    throw new Error(
      `App ${path} returned ${r.status}: ${data.error?.code || "unknown"}`,
    );
  return data;
}
try {
  const a = await fixture(),
    b = await fixture();
  await app(a, "/api/consent", "POST", { accepted: true });
  const publicProducts = must(
    await anon.from("catalog_products").select("id,name"),
    "Public active catalog",
  );
  check(
    publicProducts.length === 100,
    "100 public factual product records available",
  );
  const denied = await anon
    .from("catalog_products")
    .update({ name: "forged" })
    .eq("id", publicProducts[0].id);
  check(Boolean(denied.error), "Anonymous catalog writes denied");
  const preference = {
    skin_type: "dry",
    budget_inr: 600,
    avoid_ingredients: ["fragrance"],
    preferred_brands: [],
    fragrance_free: true,
    non_comedogenic: false,
    vegan: false,
    sensitive: false,
    avoid_retinoids: true,
    adult_confirmed: true,
  };
  await app(a, "/api/product-preferences", "PUT", preference);
  check(
    (await app(a, "/api/product-preferences")).budget_inr === 600,
    "Private product preferences persist through API",
  );
  check(
    (await app(b, "/api/product-preferences")).budget_inr === null,
    "Second user cannot inherit preferences",
  );
  check(
    must(
      await b.client.from("product_preferences").select("user_id"),
      "Preferences RLS",
    ).length === 0,
    "RLS hides another user's preferences",
  );
  const invalid = await fetch("http://127.0.0.1:3000/api/product-preferences", {
    method: "PUT",
    headers: {
      cookie: a.cookie,
      origin: "http://127.0.0.1:3000",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ...preference, budget_inr: -1 }),
  });
  check(invalid.status === 400, "Invalid budgets rejected");
  const baseline = must(
    await admin
      .from("skin_scans")
      .insert({
        user_id: a.id,
        idempotency_key: randomUUID(),
        status: "completed",
        provider_version: "youcam-v2.1-sd",
        completed_at: new Date().toISOString(),
      })
      .select("id")
      .single(),
    "Temporary baseline fixture",
  );
  const followup = must(
    await admin
      .from("skin_scans")
      .insert({
        user_id: a.id,
        idempotency_key: randomUUID(),
        status: "completed",
        provider_version: "youcam-v2.1-sd",
        completed_at: new Date().toISOString(),
      })
      .select("id")
      .single(),
    "Temporary follow-up fixture",
  );
  must(
    await admin.from("skin_scan_metrics").insert([
      {
        scan_id: baseline.id,
        metric_type: "moisture",
        ui_score: 70,
        raw_score: 70,
      },
      {
        scan_id: followup.id,
        metric_type: "moisture",
        ui_score: 73,
        raw_score: 73,
      },
    ]),
    "Temporary numeric fixtures",
  );
  const product = await app(a, "/api/products/" + publicProducts[0].id);
  const experiment = await app(a, "/api/experiments", "POST", {
    title: "Product workflow check",
    product_id: product.id,
    product_name: "untrusted name",
    baseline_scan_id: baseline.id,
    target_metric: "moisture",
    started_at: new Date().toISOString().slice(0, 10),
    frequency: "Daily",
    notes: "Temporary integration fixture",
  });
  check(
    experiment.product_id === product.id &&
      experiment.product_name === product.name,
    "Experiment keeps verified product identity and canonical name",
  );
  const log = await app(
    a,
    "/api/experiments/" + experiment.id + "/logs",
    "POST",
    {
      usage_date: new Date().toISOString().slice(0, 10),
      used: true,
      notes: "Temporary usage check",
    },
  );
  check(
    log.experiment_id === experiment.id,
    "Usage logging connects to tracked catalog product",
  );
  const account = await app(a, "/api/account");
  check(
    account.scans.length === 2 &&
      account.experiments.some((e) => e.product_id === product.id),
    "Account exposes baseline, follow-up and linked experiment for comparison",
  );
  check(
    (
      await app(
        a,
        "/api/progress/compare?a=" + baseline.id + "&b=" + followup.id,
      )
    ).find((m) => m.metric_type === "moisture")?.change?.points === 3,
    "Follow-up comparison reports the observed numerical change",
  );
  const inactive = must(
    await admin
      .from("catalog_products")
      .select("id")
      .eq("active", false)
      .limit(1),
    "Inactive catalog fixture",
  );
  if (inactive.length)
    check(
      must(
        await anon
          .from("catalog_products")
          .select("id")
          .eq("id", inactive[0].id),
        "Inactive visibility",
      ).length === 0,
      "Inactive product records are hidden by RLS",
    );
  const foreign = await fetch(
    "http://127.0.0.1:3000/api/experiments/" + experiment.id,
    { headers: { cookie: b.cookie } },
  );
  check(
    foreign.status === 404,
    "Other users cannot access tracked experiments",
  );
  console.log("Product workflow passed; no paid YouCam calls or LLM calls.");
} finally {
  for (const record of created) {
    for (const client of record.clients)
      await client.auth.signOut({ scope: "global" });
    must(
      await admin.auth.admin.deleteUser(record.id),
      "Remove exact temporary test user",
    );
  }
  console.log(
    "Temporary users, metrics, preferences and experiments cleaned up by ownership cascade.",
  );
}
