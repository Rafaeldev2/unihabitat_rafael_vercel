/**
 * Fix PostgREST schema cache: grant permissions to anon/authenticated roles
 * and notify PostgREST to reload.
 * Run: node scripts/fix-postgrest-schema.mjs
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
  env[trimmed.slice(0, eqIdx)] = trimmed.slice(eqIdx + 1);
}

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const TABLES = ["assets", "compradores", "vendedores", "tareas", "mensajes", "notas", "documentos", "oportunidades", "notificaciones"];

console.log("=== Fix PostgREST Schema Permissions ===\n");

// Grant usage on schema
const grantSQL = `
-- Grant schema usage
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- Grant table permissions
${TABLES.map(t => `GRANT SELECT, INSERT, UPDATE, DELETE ON public.${t} TO anon, authenticated;`).join("\n")}

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
`;

console.log("Running SQL grants...");
const { data, error } = await supabase.rpc("exec_sql", { sql: grantSQL });

if (error) {
  // rpc exec_sql might not exist, try individual queries via REST
  console.log("RPC not available, trying direct approach...\n");

  // Use the management API approach — just try querying with anon after a wait
  // The grants might already be in place, PostgREST just needs a cache reload

  // Try to check if grants already exist by querying information_schema
  const { data: privData, error: privError } = await supabase
    .from("information_schema.role_table_grants" )
    .select("*")
    .eq("grantee", "anon")
    .eq("table_schema", "public")
    .limit(5);

  if (privError) {
    console.log("Cannot query information_schema directly. This is expected.");
    console.log("The grants need to be run in the Supabase SQL Editor.\n");
    console.log("Run this SQL in the Supabase Dashboard > SQL Editor:\n");
    console.log("─".repeat(60));
    console.log(grantSQL);
    console.log("─".repeat(60));
  }
} else {
  console.log("✅ Grants applied and schema reloaded.");
}

// Test anon access after potential fix
console.log("\nTesting anon access...");
const anonClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
await new Promise(r => setTimeout(r, 2000)); // wait for cache reload

const { data: testData, error: testError } = await anonClient.from("assets").select("id").limit(1);
if (testError) {
  console.log(`Anon still blocked: ${testError.message} (code: ${testError.code})`);
  if (testError.code === "PGRST205") {
    console.log("\n⚠ PostgREST schema cache still stale.");
    console.log("Please run the SQL above in Supabase Dashboard > SQL Editor.");
    console.log("Alternatively, go to Settings > API and click 'Reload' on the schema cache.");
  }
} else {
  console.log(`✅ Anon access works! ${testData.length} row(s) returned.`);
}
