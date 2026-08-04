/**
 * Copia tablas CRM de Supabase prod → staging (solo lectura en prod).
 *
 * Uso:
 *   PROD_SUPABASE_URL=... PROD_SUPABASE_KEY=... \
 *   STAGING_SUPABASE_URL=... STAGING_SUPABASE_SERVICE_ROLE_KEY=... \
 *   node scripts/copy-prod-to-staging.mjs
 *
 * PROD_SUPABASE_KEY puede ser anon (si RLS permite SELECT) o service_role.
 * Nunca escribe en prod. Omite user_id (auth.users no se copia).
 */
import { createClient } from "@supabase/supabase-js";

const PROD_URL = process.env.PROD_SUPABASE_URL;
const PROD_KEY = process.env.PROD_SUPABASE_KEY;
const STAGE_URL =
  process.env.STAGING_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const STAGE_KEY =
  process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY ??
  process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!PROD_URL || !PROD_KEY || !STAGE_URL || !STAGE_KEY) {
  console.error(
    "Faltan env: PROD_SUPABASE_URL, PROD_SUPABASE_KEY, STAGING_SUPABASE_URL, STAGING_SUPABASE_SERVICE_ROLE_KEY",
  );
  process.exit(1);
}

if (PROD_URL === STAGE_URL) {
  console.error("Abort: PROD y STAGING son la misma URL");
  process.exit(1);
}

const prod = createClient(PROD_URL, PROD_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const stage = createClient(STAGE_URL, STAGE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/** @type {{ table: string, pk: string | null }[]} */
const JOBS = [
  { table: "assets", pk: "id" },
  { table: "propiedades", pk: "id" },
  { table: "vendedores", pk: "id" },
  { table: "compradores", pk: "id" },
  { table: "comprador_assets", pk: null },
  { table: "comprador_favoritos", pk: null },
  { table: "vendedor_permissions", pk: null },
  { table: "vendedor_assets", pk: null },
  { table: "vendedor_compradores", pk: null },
  { table: "tareas", pk: "id" },
  { table: "mensajes", pk: "id" },
  { table: "notas", pk: "id" },
  { table: "documentos", pk: "id" },
  { table: "oportunidades", pk: "id" },
  { table: "notificaciones", pk: "id" },
  { table: "ofertas", pk: "id" },
];

/**
 * @param {string} table
 * @param {string | null} orderCol
 */
async function fetchAll(table, orderCol) {
  const page = 500;
  let offset = 0;
  /** @type {Record<string, unknown>[]} */
  const rows = [];
  for (;;) {
    let q = prod.from(table).select("*").range(offset, offset + page - 1);
    if (orderCol) q = q.order(orderCol, { ascending: true });
    const { data, error } = await q;
    if (error) {
      if (!orderCol || !/column .* does not exist/i.test(error.message)) {
        throw new Error(`${table}: ${error.message}`);
      }
      const retry = await prod
        .from(table)
        .select("*")
        .range(offset, offset + page - 1);
      if (retry.error) throw new Error(`${table}: ${retry.error.message}`);
      rows.push(...(retry.data ?? []));
      if ((retry.data?.length ?? 0) < page) break;
      offset += page;
      continue;
    }
    rows.push(...(data ?? []));
    if ((data?.length ?? 0) < page) break;
    offset += page;
  }
  return rows;
}

/**
 * @param {string} table
 * @param {Record<string, unknown>[]} rows
 * @param {string | null} pk
 */
async function upsert(table, rows, pk) {
  if (!rows.length) return 0;
  const cleaned = rows.map((r) => {
    const o = { ...r };
    if ("user_id" in o) o.user_id = null;
    return o;
  });
  const chunk = 200;
  let n = 0;
  for (let i = 0; i < cleaned.length; i += chunk) {
    const part = cleaned.slice(i, i + chunk);
    const { error } = pk
      ? await stage.from(table).upsert(part, { onConflict: pk })
      : await stage.from(table).insert(part);
    if (error) throw new Error(`${table} write: ${error.message}`);
    n += part.length;
  }
  return n;
}

console.log(`Prod → Staging\n  from ${PROD_URL}\n  to   ${STAGE_URL}\n`);

for (const { table, pk } of JOBS) {
  try {
    const rows = await fetchAll(table, pk);
    const n = await upsert(table, rows, pk);
    console.log(`✓ ${table}: ${n}`);
  } catch (e) {
    console.error(`✗ ${table}: ${e instanceof Error ? e.message : e}`);
  }
}

console.log("\nListo. Auth users NO se copian; usa login demo o crea users en staging.");
