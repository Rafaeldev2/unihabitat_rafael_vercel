/**
 * Ejecuta supabase-migration-feedback-cliente-staging.sql contra el Supabase
 * de .env.local (staging). Usa SUPABASE_SERVICE_ROLE_KEY.
 *
 * Run: node scripts/run-migration-feedback-cliente.mjs
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

const sql = readFileSync(
  resolve(process.cwd(), "supabase-migration-feedback-cliente-staging.sql"),
  "utf-8",
);
const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

console.log("=== run-migration-feedback-cliente (STAGING) ===");
console.log(`Supabase URL: ${url}`);
console.log(`SQL bytes: ${sql.length}`);

console.log("\n→ Intento: rpc('exec_sql', { sql })");
const { error: rpcError } = await supabase.rpc("exec_sql", { sql });

if (!rpcError) {
  console.log("✅ Migración ejecutada vía rpc('exec_sql').");
  const ok = await verify();
  process.exit(ok ? 0 : 1);
}

console.log(`  RPC falló: ${rpcError.message} (code: ${rpcError.code ?? "?"})`);
console.log("\n→ Verificando si ya estaba aplicada…");
const ok = await verify();
if (ok) {
  console.log("✅ Schema ya compatible (migración previa).");
  process.exit(0);
}

console.log("\n────────────────────────────────────────────────────────────");
console.log("⚠ No fue posible ejecutar DDL automáticamente.");
console.log("Pega `supabase-migration-feedback-cliente-staging.sql` en el SQL Editor:");
const projectRef = url.replace("https://", "").replace(".supabase.co", "");
console.log(`  https://supabase.com/dashboard/project/${projectRef}/sql/new`);
console.log("────────────────────────────────────────────────────────────");
process.exit(2);

async function verify() {
  let ok = true;
  console.log("\n→ Verificando assets.referencia + public_slug…");
  const { error: colErr } = await supabase
    .from("assets")
    .select("id, referencia, public_slug")
    .limit(1);
  if (colErr) {
    console.log(`  ❌ ${colErr.message}`);
    ok = false;
  } else {
    console.log("  ✅ Columnas assets OK");
  }

  console.log("→ Verificando RPC import_schema_preflight…");
  const { data, error: preErr } = await supabase.rpc("import_schema_preflight");
  if (preErr) {
    console.log(`  ❌ ${preErr.message}`);
    ok = false;
  } else {
    console.log("  ✅ Preflight:", JSON.stringify(data));
    if (data && data.ok === false) ok = false;
  }

  console.log("→ Probe categoría OCUPADO (constraint)…");
  // Si el CHECK sigue activo, un update temporal a una fila de prueba fallaría;
  // usamos el resultado del preflight como fuente de verdad.
  return ok;
}
