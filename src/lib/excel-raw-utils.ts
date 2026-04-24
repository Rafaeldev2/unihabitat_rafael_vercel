/** Valores considerados vacíos (Excel / CRM). */
export function isEmptyExcelCell(v: string | undefined | null): boolean {
  if (v == null) return true;
  const t = String(v).trim();
  return t === "" || t === "—" || t === "--";
}

/** Valor al persistir desde un input (vacío → ""). */
export function normalizeExcelCellInput(v: string): string {
  const t = v.trim();
  if (t === "" || t === "--" || t === "—") return "";
  return t;
}

export function listEmptyExcelFields(
  excelRaw: Record<string, Record<string, string>> | undefined,
): { sheet: string; header: string }[] {
  if (!excelRaw) return [];
  const out: { sheet: string; header: string }[] = [];
  for (const [sheet, cols] of Object.entries(excelRaw)) {
    for (const [header, val] of Object.entries(cols)) {
      if (isEmptyExcelCell(val)) out.push({ sheet, header });
    }
  }
  return out;
}

export interface ExcelImportEmptyStats {
  totalEmpty: number;
  bySheet: Record<string, number>;
  /** Cabeceras únicas con al menos una celda vacía ("Hoja: Columna"). */
  sampleKeys: string[];
}

export function computeEmptyStatsFromAssets(
  assets: { excelRaw?: Record<string, Record<string, string>> }[],
): ExcelImportEmptyStats {
  const bySheet: Record<string, number> = {};
  const keyHadEmpty = new Set<string>();
  let totalEmpty = 0;
  for (const a of assets) {
    if (!a.excelRaw) continue;
    for (const [sheet, cols] of Object.entries(a.excelRaw)) {
      for (const [header, val] of Object.entries(cols)) {
        if (isEmptyExcelCell(val)) {
          totalEmpty++;
          bySheet[sheet] = (bySheet[sheet] ?? 0) + 1;
          keyHadEmpty.add(`${sheet}: ${header}`);
        }
      }
    }
  }
  return {
    totalEmpty,
    bySheet,
    sampleKeys: Array.from(keyHadEmpty).slice(0, 20),
  };
}

export function formatExcelImportEmptySummary(stats: ExcelImportEmptyStats): string {
  if (stats.totalEmpty === 0) {
    return "No se detectaron celdas vacías en las columnas importadas.";
  }
  const sheetParts = Object.entries(stats.bySheet)
    .map(([sh, n]) => `${sh}: ${n}`)
    .join("; ");
  const sample =
    stats.sampleKeys.length > 0
      ? `\nEjemplos de columnas afectadas: ${stats.sampleKeys.slice(0, 8).join(", ")}${stats.sampleKeys.length > 8 ? "…" : ""}`
      : "";
  return `Celdas vacías en el archivo: ${stats.totalEmpty} en total.\nPor hoja: ${sheetParts}.${sample}`;
}
