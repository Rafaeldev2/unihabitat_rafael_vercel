/**
 * Ejecuta supabase-migration-agentes.sql contra el Supabase configurado en
 * .env.local. Usa la SUPABASE_SERVICE_ROLE_KEY.
 *
 * Estrategia:
 * 1. Intenta llamar la RPC `exec_sql(sql text)` (común en proyectos Supabase
 *    con helper instalado) — si existe, ejecuta todo el script de una.
 * 2. Si no existe, ejecuta sentencias DDL "seguras" via supabase-js usando
 *    las APIs disponibles (alter table / create index no son ejecutables vía
 *    REST) — en este caso se imprime el SQL para pegarlo en el SQL Editor.
 *
 * Run: node scripts/run-migration-agentes.mjs
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

const sql = readFileSync(resolve(process.cwd(), "supabase-migration-agentes.sql"), "utf-8");
const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

console.log("=== run-migration-agentes ===");
console.log(`Supabase URL: ${url}`);
console.log(`SQL bytes: ${sql.length}`);

console.log("\n→ Intento 1: rpc('exec_sql', { sql })");
const { error: rpcError } = await supabase.rpc("exec_sql", { sql });

if (!rpcError) {
  console.log("✅ Migración ejecutada vía rpc('exec_sql').");
  await verify();
  process.exit(0);
}

console.log(`  RPC falló: ${rpcError.message} (code: ${rpcError.code ?? "?"})`);
console.log("\n→ Intento 2: probar si la columna ya existe (post-migración)");
await verify();

console.log("\n────────────────────────────────────────────────────────────");
console.log("⚠ No fue posible ejecutar DDL automáticamente.");
console.log("Pega el contenido de `supabase-migration-agentes.sql` en:");
console.log(`  ${url.replace("https://", "https://supabase.com/dashboard/project/").replace(".supabase.co/", "/sql/new")}`);
console.log("────────────────────────────────────────────────────────────");
process.exit(2);

async function verify() {
  console.log("\n→ Verificando que `vendedores.user_id` existe…");
  const { error: probeErr } = await supabase
    .from("vendedores")
    .select("user_id")
    .limit(1);
  if (probeErr) {
    console.log(`  ❌ Aún no existe: ${probeErr.message}`);
    return false;
  }
  console.log("  ✅ La columna `user_id` ya está disponible.");
  return true;
}
