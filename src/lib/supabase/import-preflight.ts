import { createServiceClient } from "@/lib/supabase/server";

export interface ImportSchemaPreflightResult {
  ok: boolean;
  errors: string[];
}

/**
 * Fail-fast antes de escribir batches: columnas/constraints requeridos por el
 * importador. Requiere la RPC `import_schema_preflight`.
 */
export async function runImportSchemaPreflight(): Promise<ImportSchemaPreflightResult> {
  const sb = await createServiceClient();
  const errors: string[] = [];

  const { error: colErr } = await sb.from("assets").select("id, referencia, public_slug").limit(1);
  if (colErr) errors.push(`Schema assets incompatible: ${colErr.message}`);

  const { data, error: rpcErr } = await sb.rpc("import_schema_preflight");
  if (rpcErr) {
    errors.push(`No se pudo validar schema (¿migración aplicada?): ${rpcErr.message}`);
    return { ok: false, errors };
  }

  const payload = data as { ok?: boolean; errors?: string[] } | null;
  if (payload?.ok === false && Array.isArray(payload.errors)) errors.push(...payload.errors);

  return { ok: errors.length === 0, errors };
}
