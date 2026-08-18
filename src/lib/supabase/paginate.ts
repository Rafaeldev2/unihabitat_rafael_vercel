// PostgREST aplica `db-max-rows = 1000` por request; paginamos manualmente.
export const POSTGREST_PAGE_SIZE = 1000;
const MAX_PAGES = 100;
/** Ids por request `.in()`: cada lote se pagina, el tamaño solo ajusta nº de viajes. */
const ID_CHUNK_SIZE = 500;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type QueryBuilder = any;

function dedupeById<Row>(rows: Row[]): Row[] {
  const seen = new Set<unknown>();
  const out: Row[] = [];
  for (const row of rows) {
    const id = (row as { id?: unknown }).id;
    if (id === undefined) {
      out.push(row);
      continue;
    }
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(row);
  }
  return out;
}

/**
 * Recorre todas las páginas de una query PostgREST.
 *
 * El desempate por `id` es obligatorio: `range()` sobre un ORDER BY con valores
 * repetidos (p. ej. `created_at` de una importación masiva) no define un orden
 * total, así que las páginas repiten filas y se saltan otras.
 */
export async function fetchAllPaginated<Row>(
  label: string,
  buildQuery: () => QueryBuilder,
): Promise<Row[]> {
  const all: Row[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const from = page * POSTGREST_PAGE_SIZE;
    const to = from + POSTGREST_PAGE_SIZE - 1;
    const { data, error } = await buildQuery()
      .order("id", { ascending: true })
      .range(from, to);
    if (error) {
      console.error(`[${label}] Supabase error en página ${page} (range ${from}-${to}):`, error.message);
      throw new Error(error.message);
    }
    const batch = (data ?? []) as Row[];
    all.push(...batch);
    if (batch.length < POSTGREST_PAGE_SIZE) break;
  }
  return dedupeById(all);
}

/**
 * Query `.in(column, ids)` por lotes, paginando cada lote.
 *
 * Un lote de N ids puede devolver más de 1000 filas hija, así que sin paginar
 * el lote PostgREST las trunca en silencio.
 */
export async function fetchAllByIds<Row>(
  label: string,
  buildQuery: () => QueryBuilder,
  column: string,
  ids: string[],
): Promise<Row[]> {
  const out: Row[] = [];
  for (let i = 0; i < ids.length; i += ID_CHUNK_SIZE) {
    const slice = ids.slice(i, i + ID_CHUNK_SIZE);
    const rows = await fetchAllPaginated<Row>(label, () => buildQuery().in(column, slice));
    out.push(...rows);
  }
  return dedupeById(out);
}
