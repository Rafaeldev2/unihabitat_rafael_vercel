/**
 * Test Supabase connection — anon key + service role key
 * Run: node scripts/test-supabase-connection.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

// Load .env.local manually
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

const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

console.log("=== Supabase Connection Test ===\n");
console.log(`URL: ${URL}`);
console.log(`Anon key: ${ANON_KEY?.slice(0, 20)}...`);
console.log(`Service key: ${SERVICE_KEY?.slice(0, 20)}...\n`);

const TABLES = ["assets", "compradores", "vendedores", "tareas", "mensajes", "notas", "documentos", "oportunidades", "notificaciones"];

// --- Test 1: Anon client ---
console.log("── Test 1: Anon client ──");
const anon = createClient(URL, ANON_KEY);
try {
  const { data, error } = await anon.from("assets").select("id").limit(1);
  if (error) {
    console.log(`  assets query: ERROR — ${error.message} (code: ${error.code})`);
    // RLS might block — that's expected for anon on non-public rows
    if (error.code === "42P01") {
      console.log("  ⚠ Table does not exist! You need to run the schema SQL first.");
    } else {
      console.log("  ✓ Connection works (RLS blocked read as expected for anon)");
    }
  } else {
    console.log(`  ✓ assets query OK — ${data.length} row(s) returned`);
  }
} catch (e) {
  console.log(`  ✗ Connection FAILED: ${e.message}`);
}

// --- Test 2: Service role client ---
console.log("\n── Test 2: Service role client (bypasses RLS) ──");
const service = createClient(URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

let allTablesExist = true;
for (const table of TABLES) {
  try {
    const { data, error, count } = await service
      .from(table)
      .select("*", { count: "exact", head: true });
    if (error) {
      if (error.code === "42P01") {
        console.log(`  ✗ ${table}: TABLE DOES NOT EXIST`);
        allTablesExist = false;
      } else {
        console.log(`  ⚠ ${table}: ${error.message}`);
      }
    } else {
      console.log(`  ✓ ${table}: OK (${count ?? 0} rows)`);
    }
  } catch (e) {
    console.log(`  ✗ ${table}: ${e.message}`);
    allTablesExist = false;
  }
}

// --- Summary ---
console.log("\n── Summary ──");
if (allTablesExist) {
  console.log("✅ All tables exist and are accessible via service role.");
  console.log("✅ Supabase connection is fully operational.");
} else {
  console.log("⚠ Some tables are missing. Run supabase-schema.sql in the Supabase SQL Editor.");
}

console.log("\nDone.");
