#!/usr/bin/env node
/**
 * Smoke test rápido: ¿la clave Geoapify configurada en .env.local funciona?
 * Útil tras cambiar la clave o antes de un import grande.
 *
 *   node scripts/geoapify-smoke.mjs
 *   npm run test:env
 *
 * Lee `.env.local` (sin frameworks) y prueba el endpoint de geocoding con
 * "Madrid, España". Imprime tabla con: clave detectada, status, ms, coords.
 */

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

function loadDotEnv(file) {
  if (!existsSync(file)) return {};
  const out = {};
  const text = readFileSync(file, "utf8");
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const k = line.slice(0, eq).trim();
    let v = line.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    out[k] = v;
  }
  return out;
}

function pick(env, ...names) {
  for (const n of names) {
    const v = env[n] ?? process.env[n];
    if (v && String(v).trim()) return { key: String(v).trim(), source: n };
  }
  return { key: "", source: "none" };
}

async function main() {
  const cwd = process.cwd();
  const envLocal = loadDotEnv(join(cwd, ".env.local"));
  const { key, source } = pick(envLocal, "GEOAPIFY_API_KEY", "NEXT_PUBLIC_GEOAPIFY_KEY");

  console.log("Geoapify smoke test");
  console.log("─".repeat(60));
  console.log(`source       : ${source}`);
  console.log(`key length   : ${key.length}`);

  if (!key) {
    console.error("FAIL — no Geoapify key found. Edit .env.local and add GEOAPIFY_API_KEY=<value>.");
    process.exit(2);
  }

  const url = new URL("https://api.geoapify.com/v1/geocode/search");
  url.searchParams.set("text", "Madrid, España");
  url.searchParams.set("apiKey", key);
  url.searchParams.set("limit", "1");
  url.searchParams.set("lang", "es");

  const t0 = Date.now();
  let res;
  try {
    res = await fetch(url, { headers: { Accept: "application/json" }, cache: "no-store" });
  } catch (err) {
    console.error(`FAIL — fetch error: ${err && err.message ? err.message : String(err)}`);
    process.exit(3);
  }
  const ms = Date.now() - t0;
  console.log(`http status  : ${res.status}`);
  console.log(`duration     : ${ms} ms`);

  if (!res.ok) {
    let body = "";
    try { body = await res.text(); } catch { /* ignore */ }
    console.error(`body         : ${body.slice(0, 200)}`);
    console.error("FAIL — non-OK status. 401/403 = invalid key, 429 = quota exceeded.");
    process.exit(4);
  }

  const data = await res.json();
  const c = data?.features?.[0]?.geometry?.coordinates;
  if (!Array.isArray(c) || typeof c[0] !== "number" || typeof c[1] !== "number") {
    console.error("FAIL — response had no coordinates. Quota or unexpected shape.");
    process.exit(5);
  }
  console.log(`coords       : lat=${c[1]} lon=${c[0]}`);
  console.log("OK — Geoapify key is valid and responding.");
}

main().catch((err) => {
  console.error(`FAIL — unexpected error: ${err && err.message ? err.message : String(err)}`);
  process.exit(1);
});
