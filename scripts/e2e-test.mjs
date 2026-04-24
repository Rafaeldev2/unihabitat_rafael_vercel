/**
 * E2E Test Suite — PropCRM
 * Tests: registration, login, asset CRUD, toggle pub/fav, edit fields
 * Run: node scripts/e2e-test.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

// ── Load env ──
const envPath = resolve(process.cwd(), ".env.local");
const envContent = readFileSync(envPath, "utf-8");
const env = {};
for (const line of envContent.split("\n")) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const eq = t.indexOf("=");
  if (eq === -1) continue;
  env[t.slice(0, eq)] = t.slice(eq + 1);
}

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const anonClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

let passed = 0;
let failed = 0;
const errors = [];

function assert(condition, name) {
  if (condition) {
    console.log(`  ✓ ${name}`);
    passed++;
  } else {
    console.log(`  ✗ ${name}`);
    failed++;
    errors.push(name);
  }
}

// ── Test IDs (will be cleaned up) ──
const TEST_COMPRADOR_ID = "TEST-COMPRADOR-E2E-001";
const TEST_ASSET_ID = "TEST-ASSET-E2E-001";
const TEST_ASSET_ID_2 = "TEST-ASSET-E2E-002";

// ══════════════════════════════════════════
// Cleanup before tests
// ══════════════════════════════════════════
console.log("\n=== PropCRM E2E Test Suite ===\n");
console.log("── Cleanup ──");
await supabase.from("oportunidades").delete().in("asset_id", [TEST_ASSET_ID, TEST_ASSET_ID_2]);
await supabase.from("mensajes").delete().in("asset_id", [TEST_ASSET_ID, TEST_ASSET_ID_2]);
await supabase.from("notas").delete().in("asset_id", [TEST_ASSET_ID, TEST_ASSET_ID_2]);
await supabase.from("documentos").delete().in("asset_id", [TEST_ASSET_ID, TEST_ASSET_ID_2]);
await supabase.from("mensajes").delete().eq("comprador_id", TEST_COMPRADOR_ID);
await supabase.from("notas").delete().eq("comprador_id", TEST_COMPRADOR_ID);
await supabase.from("documentos").delete().eq("comprador_id", TEST_COMPRADOR_ID);
await supabase.from("oportunidades").delete().eq("comprador_id", TEST_COMPRADOR_ID);
await supabase.from("compradores").delete().eq("id", TEST_COMPRADOR_ID);
await supabase.from("assets").delete().in("id", [TEST_ASSET_ID, TEST_ASSET_ID_2]);
console.log("  Done.\n");

// ══════════════════════════════════════════
// 1. REGISTRO DE USUARIO (compradores)
// ══════════════════════════════════════════
console.log("── 1. Registro de usuario (comprador) ──");
{
  const row = {
    id: TEST_COMPRADOR_ID,
    nombre: "Juan Test García",
    ini: "JT",
    col: "#2563a8,#0d2a4a",
    tipo: "Privado",
    agente: "Admin",
    email: "juantest@propcrm.com",
    tel: "+34 612 345 678",
    intereses: "Viviendas en Madrid",
    presupuesto: "150.000 €",
    activos: "0",
    actividad: "",
    estado: "Nuevo",
    estado_c: "fp-nd",
    nda: "Pendiente",
  };

  const { error } = await supabase.from("compradores").upsert(row, { onConflict: "id" });
  assert(!error, `INSERT comprador: ${error?.message || "OK"}`);

  // Verify it was saved
  const { data, error: fetchErr } = await supabase
    .from("compradores")
    .select("*")
    .eq("id", TEST_COMPRADOR_ID)
    .maybeSingle();
  assert(!fetchErr && data !== null, "FETCH comprador by ID");
  assert(data?.nombre === "Juan Test García", "Comprador nombre matches");
  assert(data?.email === "juantest@propcrm.com", "Comprador email matches");
  assert(data?.tipo === "Privado", "Comprador tipo matches");
  assert(data?.estado === "Nuevo", "Comprador estado matches");
  assert(data?.nda === "Pendiente", "Comprador NDA matches");
}

// ══════════════════════════════════════════
// 2. EDITAR COMPRADOR (update)
// ══════════════════════════════════════════
console.log("\n── 2. Editar comprador ──");
{
  const { error } = await supabase
    .from("compradores")
    .update({ estado: "Activo", estado_c: "fp-act", nda: "Firmada", presupuesto: "200.000 €" })
    .eq("id", TEST_COMPRADOR_ID);
  assert(!error, `UPDATE comprador: ${error?.message || "OK"}`);

  const { data } = await supabase.from("compradores").select("*").eq("id", TEST_COMPRADOR_ID).maybeSingle();
  assert(data?.estado === "Activo", "Comprador estado updated to Activo");
  assert(data?.nda === "Firmada", "Comprador NDA updated to Firmada");
  assert(data?.presupuesto === "200.000 €", "Comprador presupuesto updated");
}

// ══════════════════════════════════════════
// 3. CREAR ACTIVOS (assets)
// ══════════════════════════════════════════
console.log("\n── 3. Crear activos ──");
{
  const asset1 = {
    id: TEST_ASSET_ID,
    cat: "Residencial", prov: "Madrid", pob: "Madrid", cp: "28001",
    addr: "Calle Gran Vía 42", tip: "Vivienda", tip_c: "tp-viv",
    fase: "Suspendido", fase_c: "fp-sus", precio: 185000, fav: false,
    sqm: 85, pub: false, descr: "Piso luminoso en pleno centro",
    owner_name: "María López", owner_tel: "+34 611 222 333",
    owner_mail: "maria@test.com", ccaa: "Comunidad de Madrid",
    adm_pip: "PIPE-001", adm_str: "Venta directa",
  };

  const asset2 = {
    id: TEST_ASSET_ID_2,
    cat: "Comercial", prov: "Barcelona", pob: "Barcelona", cp: "08001",
    addr: "Rambla Catalunya 100", tip: "Local", tip_c: "tp-loc",
    fase: "Suspendido", fase_c: "fp-sus", precio: 320000, fav: false,
    sqm: 120, pub: false, descr: "Local comercial zona premium",
    owner_name: "Pedro Martín", owner_tel: "+34 622 333 444",
    owner_mail: "pedro@test.com", ccaa: "Cataluña",
    adm_pip: "PIPE-002", adm_str: "Subasta",
  };

  const { error: err1 } = await supabase.from("assets").upsert(asset1, { onConflict: "id" });
  assert(!err1, `INSERT asset 1 (Madrid): ${err1?.message || "OK"}`);

  const { error: err2 } = await supabase.from("assets").upsert(asset2, { onConflict: "id" });
  assert(!err2, `INSERT asset 2 (Barcelona): ${err2?.message || "OK"}`);

  // Verify count
  const { count } = await supabase
    .from("assets")
    .select("*", { count: "exact", head: true })
    .in("id", [TEST_ASSET_ID, TEST_ASSET_ID_2]);
  assert(count === 2, `2 assets in DB (got ${count})`);
}

// ══════════════════════════════════════════
// 4. FETCH ASSET BY ID
// ══════════════════════════════════════════
console.log("\n── 4. Fetch asset por ID ──");
{
  const { data, error } = await supabase.from("assets").select("*").eq("id", TEST_ASSET_ID).maybeSingle();
  assert(!error && data !== null, "Fetch asset by ID");
  assert(data?.prov === "Madrid", "Asset provincia = Madrid");
  assert(data?.precio == 185000, "Asset precio = 185000");
  assert(data?.sqm == 85, "Asset sqm = 85");
  assert(data?.pub === false, "Asset pub = false (not published)");
  assert(data?.adm_pip === "PIPE-001", "Asset adm_pip = PIPE-001");
}

// ══════════════════════════════════════════
// 5. EDITAR CAMPOS DEL ACTIVO
// ══════════════════════════════════════════
console.log("\n── 5. Editar campos del activo ──");
{
  const { error } = await supabase
    .from("assets")
    .update({ precio: 175000, descr: "Piso reformado en Gran Vía — precio rebajado", addr: "Calle Gran Vía 42, 3ºA" })
    .eq("id", TEST_ASSET_ID);
  assert(!error, `UPDATE asset fields: ${error?.message || "OK"}`);

  const { data } = await supabase.from("assets").select("precio, descr, addr").eq("id", TEST_ASSET_ID).maybeSingle();
  assert(data?.precio == 175000, "Precio updated to 175000");
  assert(data?.descr.includes("reformado"), "Descripción updated");
  assert(data?.addr.includes("3ºA"), "Dirección updated");
}

// ══════════════════════════════════════════
// 6. TOGGLE PUBLICAR ACTIVO
// ══════════════════════════════════════════
console.log("\n── 6. Toggle publicar activo ──");
{
  // Publish
  const { error: pubErr } = await supabase
    .from("assets")
    .update({ pub: true, fase: "Publicado", fase_c: "fp-pub" })
    .eq("id", TEST_ASSET_ID);
  assert(!pubErr, "Publish asset");

  const { data: pubData } = await supabase.from("assets").select("pub, fase, fase_c").eq("id", TEST_ASSET_ID).maybeSingle();
  assert(pubData?.pub === true, "Asset pub = true");
  assert(pubData?.fase === "Publicado", "Asset fase = Publicado");

  // Unpublish
  const { error: unpubErr } = await supabase
    .from("assets")
    .update({ pub: false, fase: "Suspendido", fase_c: "fp-sus" })
    .eq("id", TEST_ASSET_ID);
  assert(!unpubErr, "Unpublish asset");

  const { data: unpubData } = await supabase.from("assets").select("pub, fase").eq("id", TEST_ASSET_ID).maybeSingle();
  assert(unpubData?.pub === false, "Asset pub = false after unpublish");
  assert(unpubData?.fase === "Suspendido", "Asset fase = Suspendido after unpublish");
}

// ══════════════════════════════════════════
// 7. TOGGLE FAVORITO
// ══════════════════════════════════════════
console.log("\n── 7. Toggle favorito ──");
{
  const { error } = await supabase.from("assets").update({ fav: true }).eq("id", TEST_ASSET_ID);
  assert(!error, "Set fav = true");

  const { data } = await supabase.from("assets").select("fav").eq("id", TEST_ASSET_ID).maybeSingle();
  assert(data?.fav === true, "Asset fav = true");

  await supabase.from("assets").update({ fav: false }).eq("id", TEST_ASSET_ID);
  const { data: d2 } = await supabase.from("assets").select("fav").eq("id", TEST_ASSET_ID).maybeSingle();
  assert(d2?.fav === false, "Asset fav toggled back to false");
}

// ══════════════════════════════════════════
// 8. FETCH PUBLIC ASSETS (pub = true)
// ══════════════════════════════════════════
console.log("\n── 8. Fetch assets públicos ──");
{
  // Publish one asset
  await supabase.from("assets").update({ pub: true, fase: "Publicado", fase_c: "fp-pub" }).eq("id", TEST_ASSET_ID);

  const { data, error } = await supabase.from("assets").select("*").eq("pub", true).in("id", [TEST_ASSET_ID, TEST_ASSET_ID_2]);
  assert(!error, "Fetch public assets query");
  assert(data?.length === 1, `Only 1 public asset (got ${data?.length})`);
  assert(data?.[0]?.id === TEST_ASSET_ID, "Public asset is the Madrid one");
}

// ══════════════════════════════════════════
// 9. ANON CLIENT — PORTAL ACCESS
// ══════════════════════════════════════════
console.log("\n── 9. Anon client (portal público) ──");
{
  const { data, error } = await anonClient.from("assets").select("id, prov, precio, pub").eq("pub", true);
  assert(!error, `Anon fetch public assets: ${error?.message || "OK"}`);
  const testAsset = data?.find(a => a.id === TEST_ASSET_ID);
  assert(testAsset !== undefined, "Anon can see published test asset");
  assert(testAsset?.prov === "Madrid", "Anon sees correct provincia");
}

// ══════════════════════════════════════════
// 10. BATCH UPSERT (simulating Excel import)
// ══════════════════════════════════════════
console.log("\n── 10. Batch upsert (simula import Excel) ──");
{
  // Update existing + verify no duplicate
  const batchRows = [
    { id: TEST_ASSET_ID, precio: 190000, descr: "Actualizado vía batch" },
    { id: TEST_ASSET_ID_2, precio: 310000, descr: "Actualizado vía batch" },
  ];

  const { error } = await supabase.from("assets").upsert(batchRows, { onConflict: "id", ignoreDuplicates: false });
  assert(!error, `Batch upsert: ${error?.message || "OK"}`);

  const { data } = await supabase.from("assets").select("id, precio, descr").in("id", [TEST_ASSET_ID, TEST_ASSET_ID_2]);
  const a1 = data?.find(a => a.id === TEST_ASSET_ID);
  const a2 = data?.find(a => a.id === TEST_ASSET_ID_2);
  assert(a1?.precio == 190000, "Batch updated asset 1 precio");
  assert(a2?.precio == 310000, "Batch updated asset 2 precio");
  assert(a1?.descr === "Actualizado vía batch", "Batch updated asset 1 descr");
}

// ══════════════════════════════════════════
// 11. OPORTUNIDADES (matching)
// ══════════════════════════════════════════
console.log("\n── 11. Oportunidades ──");
{
  const opp = {
    comprador_id: TEST_COMPRADOR_ID,
    asset_id: TEST_ASSET_ID,
    score: 75,
    estado: "nueva",
  };

  const { error } = await supabase.from("oportunidades").upsert(opp, { onConflict: "comprador_id,asset_id" });
  assert(!error, `INSERT oportunidad: ${error?.message || "OK"}`);

  const { data } = await supabase.from("oportunidades").select("*").eq("comprador_id", TEST_COMPRADOR_ID).eq("asset_id", TEST_ASSET_ID).maybeSingle();
  assert(data?.score === 75, "Oportunidad score = 75");
  assert(data?.estado === "nueva", "Oportunidad estado = nueva");

  // Update estado
  const { error: updErr } = await supabase
    .from("oportunidades")
    .update({ estado: "contactada" })
    .eq("comprador_id", TEST_COMPRADOR_ID)
    .eq("asset_id", TEST_ASSET_ID);
  assert(!updErr, "UPDATE oportunidad estado");

  const { data: d2 } = await supabase.from("oportunidades").select("estado").eq("comprador_id", TEST_COMPRADOR_ID).eq("asset_id", TEST_ASSET_ID).maybeSingle();
  assert(d2?.estado === "contactada", "Oportunidad estado updated to contactada");
}

// ══════════════════════════════════════════
// 12. MENSAJES
// ══════════════════════════════════════════
console.log("\n── 12. Mensajes ──");
{
  const msg = {
    asset_id: TEST_ASSET_ID,
    comprador_id: TEST_COMPRADOR_ID,
    from_role: "cli",
    from_name: "Juan Test",
    text: "Me interesa este piso, ¿está disponible para visita?",
  };

  const { error } = await supabase.from("mensajes").insert(msg);
  assert(!error, `INSERT mensaje cliente: ${error?.message || "OK"}`);

  const msgAdmin = {
    asset_id: TEST_ASSET_ID,
    comprador_id: TEST_COMPRADOR_ID,
    from_role: "adm",
    from_name: "Admin",
    text: "Sí, podemos coordinar una visita esta semana.",
  };

  const { error: err2 } = await supabase.from("mensajes").insert(msgAdmin);
  assert(!err2, `INSERT mensaje admin: ${err2?.message || "OK"}`);

  const { data, count } = await supabase
    .from("mensajes")
    .select("*", { count: "exact" })
    .eq("asset_id", TEST_ASSET_ID)
    .eq("comprador_id", TEST_COMPRADOR_ID)
    .order("created_at");
  assert(count === 2, `2 mensajes in conversation (got ${count})`);
  assert(data?.[0]?.from_role === "cli", "First message from client");
  assert(data?.[1]?.from_role === "adm", "Second message from admin");
}

// ══════════════════════════════════════════
// 13. NOTAS
// ══════════════════════════════════════════
console.log("\n── 13. Notas ──");
{
  const nota = {
    asset_id: TEST_ASSET_ID,
    author: "Admin",
    text: "Cliente muy interesado, tiene financiación pre-aprobada.",
  };

  const { error } = await supabase.from("notas").insert(nota);
  assert(!error, `INSERT nota: ${error?.message || "OK"}`);

  const { data } = await supabase.from("notas").select("*").eq("asset_id", TEST_ASSET_ID);
  assert(data?.length >= 1, "Nota saved and retrievable");
}

// ══════════════════════════════════════════
// 14. TAREAS
// ══════════════════════════════════════════
console.log("\n── 14. Tareas ──");
{
  const tarea = {
    titulo: "Coordinar visita con Juan Test",
    agente: "Admin",
    detalle: "Piso Gran Vía — disponible L-V 10-14h",
    prioridad: "urgente",
    fecha: "2026-03-20",
    done: false,
  };

  const { data, error } = await supabase.from("tareas").insert(tarea).select("id").single();
  assert(!error, `INSERT tarea: ${error?.message || "OK"}`);

  const tareaId = data?.id;

  // Mark as done
  const { error: doneErr } = await supabase.from("tareas").update({ done: true, prioridad: "completada" }).eq("id", tareaId);
  assert(!doneErr, "UPDATE tarea to done");

  const { data: d2 } = await supabase.from("tareas").select("done, prioridad").eq("id", tareaId).maybeSingle();
  assert(d2?.done === true, "Tarea done = true");
  assert(d2?.prioridad === "completada", "Tarea prioridad = completada");

  // Cleanup
  await supabase.from("tareas").delete().eq("id", tareaId);
}

// ══════════════════════════════════════════
// 15. VENDEDORES
// ══════════════════════════════════════════
console.log("\n── 15. Vendedores ──");
{
  const vendedorId = "TEST-VENDEDOR-E2E-001";
  const vendedor = {
    id: vendedorId,
    nombre: "Banco Test S.A.",
    ini: "BT",
    col: "#d4762a,#6a3510",
    cartera: "NPL Madrid",
    activo: "15",
    agente: "Admin",
    tel: "+34 900 100 200",
    email: "cartera@bancotest.com",
    ultimo: "2026-03-15",
    estado: "Activo",
    estado_c: "fp-act",
  };

  const { error } = await supabase.from("vendedores").upsert(vendedor, { onConflict: "id" });
  assert(!error, `INSERT vendedor: ${error?.message || "OK"}`);

  const { data } = await supabase.from("vendedores").select("*").eq("id", vendedorId).maybeSingle();
  assert(data?.nombre === "Banco Test S.A.", "Vendedor nombre matches");
  assert(data?.cartera === "NPL Madrid", "Vendedor cartera matches");

  // Cleanup
  await supabase.from("vendedores").delete().eq("id", vendedorId);
}

// ══════════════════════════════════════════
// 16. DOCUMENTOS
// ══════════════════════════════════════════
console.log("\n── 16. Documentos ──");
{
  const doc = {
    asset_id: TEST_ASSET_ID,
    name: "Nota Simple Registro.pdf",
    storage_path: `assets/${TEST_ASSET_ID}/nota-simple.pdf`,
    icon_type: "pdf",
    size_bytes: 245000,
    uploaded_by: "Admin",
  };

  const { error } = await supabase.from("documentos").insert(doc);
  assert(!error, `INSERT documento: ${error?.message || "OK"}`);

  const { data } = await supabase.from("documentos").select("*").eq("asset_id", TEST_ASSET_ID);
  assert(data?.length >= 1, "Documento saved and retrievable");
  assert(data?.[0]?.icon_type === "pdf", "Documento icon_type = pdf");
}

// ══════════════════════════════════════════
// 17. NOTIFICACIONES
// ══════════════════════════════════════════
console.log("\n── 17. Notificaciones ──");
{
  const notif = {
    tipo: "match",
    mensaje: "Nuevo match: Juan Test ↔ Piso Gran Vía (75pts)",
    referencia_id: TEST_ASSET_ID,
    leida: false,
  };

  const { data, error } = await supabase.from("notificaciones").insert(notif).select("id").single();
  assert(!error, `INSERT notificación: ${error?.message || "OK"}`);

  // Mark as read
  const { error: readErr } = await supabase.from("notificaciones").update({ leida: true }).eq("id", data?.id);
  assert(!readErr, "Mark notificación as read");

  const { data: d2 } = await supabase.from("notificaciones").select("leida").eq("id", data?.id).maybeSingle();
  assert(d2?.leida === true, "Notificación leida = true");

  // Cleanup
  await supabase.from("notificaciones").delete().eq("id", data?.id);
}

// ══════════════════════════════════════════
// CLEANUP
// ══════════════════════════════════════════
console.log("\n── Cleanup ──");
await supabase.from("oportunidades").delete().eq("comprador_id", TEST_COMPRADOR_ID);
await supabase.from("mensajes").delete().eq("comprador_id", TEST_COMPRADOR_ID);
await supabase.from("notas").delete().eq("asset_id", TEST_ASSET_ID);
await supabase.from("documentos").delete().eq("asset_id", TEST_ASSET_ID);
await supabase.from("compradores").delete().eq("id", TEST_COMPRADOR_ID);
await supabase.from("assets").delete().in("id", [TEST_ASSET_ID, TEST_ASSET_ID_2]);
console.log("  Test data cleaned up.\n");

// ══════════════════════════════════════════
// RESULTS
// ══════════════════════════════════════════
console.log("═".repeat(50));
console.log(`  RESULTS: ${passed} passed, ${failed} failed`);
console.log("═".repeat(50));
if (failed > 0) {
  console.log("\nFailed tests:");
  errors.forEach(e => console.log(`  ✗ ${e}`));
  process.exit(1);
} else {
  console.log("\n✅ ALL TESTS PASSED — Sistema 100% operativo.\n");
}
