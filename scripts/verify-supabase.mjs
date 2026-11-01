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
  must(
    await admin.from("skin_scans").select("id").limit(1),
    "Server database access",
  );
  const a = await fixture(),
    b = await fixture();
  const profiles = must(
    await a.client.from("profiles").select("id"),
    "Authenticated profiles",
  );
  check(
    profiles.length === 1 && profiles[0].id === a.id,
    "RLS hides the second user profile",
  );
  const anonymous = await anon.from("skin_scans").select("id");
  check(Boolean(anonymous.error), "Anonymous database reads are denied");
  const deniedRpc = await a.client.rpc("take_quota", {
    p_user: a.id,
    p_scope: "qa",
    p_limit: 5,
    p_window: 60,
  });
  check(
    Boolean(deniedRpc.error),
    "Authenticated client cannot invoke privileged server RPC",
  );
  const state = await app(a, "/api/account");
  check(
    state.scans.length === 0 && !state.consent,
    "Real account API returns an honest empty state",
  );
  await app(a, "/api/consent", "POST", { accepted: true });
  await app(a, "/api/account", "PATCH", {
    display_name: "Connection check updated",
    llm_consent: false,
  });
  const updated = await app(a, "/api/account");
  check(
    updated.consent &&
      updated.profile.display_name === "Connection check updated",
    "Onboarding consent and profile preferences persist",
  );
  const history = await app(a, "/api/scans");
  check(
    Array.isArray(history) && history.length === 0,
    "Authenticated scan history works",
  );
  const insight = await app(a, "/api/insights", "POST", {
    question: "What measurements are available?",
  });
  check(
    insight.source === "deterministic" &&
      insight.response.includes("No measurements"),
    "Insights remain deterministic without provider configuration",
  );
  const image = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jB4kAAAAASUVORK5CYII=",
    "base64",
  );
  must(
    await admin.storage
      .from("skin-photos")
      .upload(path, image, { contentType: "image/png" }),
    "Private storage test upload",
  );
  uploaded = true;
  const privateRead = await anon.storage.from("skin-photos").download(path);
  check(Boolean(privateRead.error), "Anonymous photo downloads are denied");
  const signed = must(
    await admin.storage.from("skin-photos").createSignedUrl(path, 30),
    "Create expiring photo URL",
  );
  const response = await fetch(signed.signedUrl);
  check(response.ok, "Short-lived signed photo access works");
  check(
    (await app(b, "/api/account")).consent === false,
    "One user cannot inherit another user consent",
  );
  const blocked = await fetch("http://127.0.0.1:3000/api/scans", {
    method: "POST",
    headers: { cookie: a.cookie, origin: "http://127.0.0.1:3000" },
  });
  const block = await blocked.json();
  check(
    blocked.status === 503 && block.error.code === "RETENTION_NOT_ENABLED",
    "Live analysis remains gated until retention and YouCam are configured",
  );
  console.log(
    "Live integration checks completed; no photos or synthetic metrics analyzed by YouCam.",
  );
} finally {
  if (uploaded)
    must(
      await admin.storage.from("skin-photos").remove([path]),
      "Remove exact test object",
    );
  for (const record of created) {
    for (const client of record.clients)
      await client.auth.signOut({ scope: "global" });
    must(
      await admin.auth.admin.deleteUser(record.id),
      "Remove exact temporary test user",
    );
  }
  console.log("Temporary test users and storage object cleaned up.");
}
