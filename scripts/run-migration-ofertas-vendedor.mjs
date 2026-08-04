/**
 * Ejecuta supabase-migration-ofertas-vendedor.sql contra .env.local (staging).
 * Run: node scripts/run-migration-ofertas-vendedor.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

const envPath = resolve(process.cwd(), ".env.local");
const envContent = readFileSync(envPath, "utf-8");
const env = {};
for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eqIdx = trimmed.indexOf("=");
  if (eqIdx === -1) continue;
  let value = trimmed.slice(eqIdx + 1).trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  env[trimmed.slice(0, eqIdx).trim()] = value;
}

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local");
  process.exit(1);
}

if (url.includes("ywvczogdjanhdnibzmfg")) {
  console.error("ABORT: .env.local apunta a Supabase PRODUCCIÓN. Solo staging.");
  process.exit(1);
}

const sql = readFileSync(resolve(process.cwd(), "supabase-migration-ofertas-vendedor.sql"), "utf-8");
const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

console.log("=== run-migration-ofertas-vendedor (STAGING) ===");
console.log(`Supabase URL: ${url}`);

const { error: rpcError } = await supabase.rpc("exec_sql", { sql });
if (!rpcError) {
  console.log("✅ Migración ejecutada vía rpc('exec_sql').");
  process.exit((await verify()) ? 0 : 1);
}

console.log(`  RPC falló: ${rpcError.message}`);
if (await verify()) {
  console.log("✅ Schema ya compatible (migración previa).");
  process.exit(0);
}

const projectRef = url.replace("https://", "").replace(".supabase.co", "");
console.log("\n⚠ Pega supabase-migration-ofertas-vendedor.sql en el SQL Editor:");
console.log(`  https://supabase.com/dashboard/project/${projectRef}/sql/new`);
process.exit(2);

async function verify() {
  const { error } = await supabase.from("ofertas").select("id, comprador_id, vendedor_id").limit(1);
  if (error) {
    console.error("  verify fail:", error.message);
    return false;
  }
  console.log("✅ ofertas.vendedor_id seleccionable.");
  return true;
}
