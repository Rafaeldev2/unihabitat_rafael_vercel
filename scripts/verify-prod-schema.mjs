/**
 * Verifica columnas críticas en Supabase PRODUCCIÓN.
 *
 * Uso:
 *   PROD_ENV_FILE=/path/to/.env.local node scripts/verify-prod-schema.mjs
 * o:
 *   PROD_SUPABASE_URL=... PROD_SUPABASE_SERVICE_ROLE_KEY=... node scripts/verify-prod-schema.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";

function loadEnvFile(path) {
  const env = {};
  if (!existsSync(path)) return env;
  for (const line of readFileSync(path, "utf-8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    env[t.slice(0, i).trim()] = v;
  }
  return env;
}

const fileEnv = loadEnvFile(
  process.env.PROD_ENV_FILE ||
    "/Users/christianmock/Trabajo/unihabitad/.env.local",
);
const url = (process.env.PROD_SUPABASE_URL || fileEnv.NEXT_PUBLIC_SUPABASE_URL || fileEnv.SUPABASE_URL || "")
  .replace(/\/$/, "");
const key =
  process.env.PROD_SUPABASE_SERVICE_ROLE_KEY ||
  fileEnv.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Faltan URL/key de prod");
  process.exit(1);
}
if (!url.includes("ywvczogdjanhdnibzmfg")) {
  console.error("ABORT: URL no es producción:", url);
  process.exit(1);
}

const sb = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const checks = [
  ["assets.public_slug", () => sb.from("assets").select("id,public_slug").limit(1)],
  ["compradores.acceso", () => sb.from("compradores").select("id,acceso").limit(1)],
  ["ofertas.vendedor_id", () => sb.from("ofertas").select("id,vendedor_id").limit(1)],
];

let ok = true;
console.log("PROD", url);
for (const [label, fn] of checks) {
  const { error } = await fn();
  if (error) {
    ok = false;
    console.log(`❌ ${label}: ${error.message}`);
  } else {
    console.log(`✅ ${label}`);
  }
}
process.exit(ok ? 0 : 2);
