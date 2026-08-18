import { createServiceClient } from "@/lib/supabase/server";
import { fetchAllPaginated } from "@/lib/supabase/paginate";
import { mergeExcelRawMaps, propiedadToRow } from "@/lib/supabase/db";
import {
  buildAssetUpsertRow, dedupAssetsById, dedupPropiedadesById, resolveAssetSlug,
  type DbRow,
} from "@/lib/supabase/upsert-merge";
import type { Asset, Propiedad } from "@/lib/types";

export interface UpsertResult {
  inserted: number;
  updated: number;
  errors: string[];
  duplicatesMerged: Record<string, number>;
}

const BATCH_SIZE = 50;
type Client = Awaited<ReturnType<typeof createServiceClient>>;
type BuildRows<T> = (batch: T[], existing: Map<string, DbRow>) => DbRow[];

async function readTakenSlugs(sb: Client): Promise<Set<string>> {
  const rows = await fetchAllPaginated<{ public_slug: string | null }>(
    "upsertAssets.slugs",
    () => sb.from("assets").select("public_slug"),
  );
  const taken = new Set<string>();
  for (const r of rows) {
    if (r.public_slug) taken.add(String(r.public_slug));
  }
  return taken;
}

async function existingRowsById(
  sb: Client, table: string, columns: string, ids: string[],
): Promise<Map<string, DbRow>> {
  const { data, error } = await sb.from(table).select(columns).in("id", ids);
  if (error) throw new Error(error.message);
  const map = new Map<string, DbRow>();
  for (const row of (data ?? []) as DbRow[]) map.set(row.id, row);
  return map;
}

async function runBatches<T extends { id: string }>(
  sb: Client, table: string, columns: string, items: T[], buildRows: BuildRows<T>,
): Promise<Omit<UpsertResult, "duplicatesMerged">> {
  let inserted = 0;
  let updated = 0;
  const errors: string[] = [];
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);
    const failure = await writeOneBatch(sb, table, columns, batch, buildRows);
    if (failure.error) {
      console.error(`[upsert ${table}] batch ${i}: ${failure.error}`);
      errors.push(`Batch ${i}: ${failure.error}`);
      continue;
    }
    inserted += failure.inserted;
    updated += failure.updated;
  }
  return { inserted, updated, errors };
}

async function writeOneBatch<T extends { id: string }>(
  sb: Client, table: string, columns: string, batch: T[], buildRows: BuildRows<T>,
): Promise<{ inserted: number; updated: number; error: string | null }> {
  try {
    const existing = await existingRowsById(sb, table, columns, batch.map((x) => x.id));
    const rows = buildRows(batch, existing);
    const { error } = await sb.from(table).upsert(rows, { onConflict: "id", ignoreDuplicates: false });
    if (error) return { inserted: 0, updated: 0, error: error.message };
    const updated = rows.filter((r) => existing.has(r.id)).length;
    return { inserted: rows.length - updated, updated, error: null };
  } catch (err) {
    return { inserted: 0, updated: 0, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function upsertAssetRows(assets: Asset[]): Promise<UpsertResult> {
  const sb = await createServiceClient();
  const { deduped, duplicates } = dedupAssetsById(assets);
  const taken = await readTakenSlugs(sb);
  const outcome = await runBatches(sb, "assets", "*", deduped, (batch, existing) =>
    batch.map((a) => {
      const prev = existing.get(a.id);
      const slug = resolveAssetSlug(a, prev, taken);
      a.publicSlug = slug;
      return buildAssetUpsertRow(a, prev, slug);
    }),
  );
  return { ...outcome, duplicatesMerged: duplicates };
}

export async function upsertPropiedadRows(propiedades: Propiedad[]): Promise<UpsertResult> {
  const sb = await createServiceClient();
  const { deduped, duplicates } = dedupPropiedadesById(propiedades);
  const outcome = await runBatches(sb, "propiedades", "id, excel_raw", deduped, (batch, existing) =>
    batch.map((p) => {
      const row = propiedadToRow(p);
      const merged = mergeExcelRawMaps(existing.get(p.id)?.excel_raw, row.excel_raw);
      if (merged) row.excel_raw = merged;
      return row;
    }),
  );
  return { ...outcome, duplicatesMerged: duplicates };
}
