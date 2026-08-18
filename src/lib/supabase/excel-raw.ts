const MAX_EXCEL_RAW_JSON_CHARS = 500_000;
const MAX_SHEET_NAME = 200;
const MAX_HEADER_NAME = 500;
const MAX_CELL_CHARS = 50_000;

type ExcelRaw = Record<string, Record<string, string>>;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === "object" && !Array.isArray(v);
}

function validateSheet(name: string, value: unknown): Record<string, string> {
  if (!isPlainObject(value)) throw new Error(`Contenido de hoja "${name}" inválido`);
  const inner: Record<string, string> = {};
  for (const [header, cell] of Object.entries(value)) {
    if (header.length > MAX_HEADER_NAME) throw new Error("Nombre de columna inválido");
    inner[header] = cell == null ? "" : String(cell).slice(0, MAX_CELL_CHARS);
  }
  return inner;
}

/** Saneado del blob de Excel antes de persistirlo (tamaño y forma). */
export function validateExcelRawPayload(obj: unknown): ExcelRaw {
  if (!isPlainObject(obj)) throw new Error("Formato excel_raw inválido");
  const out: ExcelRaw = {};
  for (const [sheet, value] of Object.entries(obj)) {
    if (sheet.length > MAX_SHEET_NAME) throw new Error("Nombre de hoja inválido");
    out[sheet] = validateSheet(sheet, value);
  }
  if (JSON.stringify(out).length > MAX_EXCEL_RAW_JSON_CHARS) {
    throw new Error("excel_raw demasiado grande; reduzca el contenido");
  }
  return out;
}
