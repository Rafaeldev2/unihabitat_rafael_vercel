/**
 * Categorías de error reportadas al usuario en el resumen de upload de Excel.
 * Compartido entre el server action de Catastro y la UI cliente (modal de
 * upload) — por eso vive en un módulo puro sin "use server".
 */
export type CatastroFailureCategory =
  | "http_5xx_429"
  | "http_4xx"
  | "timeout"
  | "ref_not_found"
  | "structure_unknown"
  | "network_error"
  | "other";

export function classifyCatastroError(msg: string): CatastroFailureCategory {
  const m = msg ?? "";
  if (/HTTP\s*(429|5\d\d)/i.test(m)) return "http_5xx_429";
  if (/HTTP\s*4\d\d/i.test(m)) return "http_4xx";
  if (/tiempo de espera|abort|timeout/i.test(m)) return "timeout";
  if (/no se encontró información|referencia catastral no v[aá]lida/i.test(m)) return "ref_not_found";
  if (/estructura no reconocida/i.test(m)) return "structure_unknown";
  if (/fetch failed|econnreset|enotfound|etimedout|network|socket hang up/i.test(m)) return "network_error";
  return "other";
}

export function emptyCategoryTotals(): Record<CatastroFailureCategory, number> {
  return {
    http_5xx_429: 0, http_4xx: 0, timeout: 0,
    ref_not_found: 0, structure_unknown: 0, network_error: 0, other: 0,
  };
}

export function tallyCatastroFailures(
  failures: { error: string }[],
): Record<CatastroFailureCategory, number> {
  const out = emptyCategoryTotals();
  for (const f of failures) out[classifyCatastroError(f.error)]++;
  return out;
}
