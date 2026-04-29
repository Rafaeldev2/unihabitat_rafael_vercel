"use server";

import type { Asset } from "@/lib/types";

const API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-20250514";
const BATCH_SIZE = 20;

export interface ClaudeAssetResult {
  id: string;
  tip?: string;
  tipC?: string;
  fase?: string;
  faseC?: string;
  prov?: string;
  cp?: string;
  warnings: string[];
}

export interface ClaudeValidationResult {
  assets: ClaudeAssetResult[];
  summary: string;
}

const SYSTEM_PROMPT = `Eres un asistente experto en activos inmobiliarios NPL/REO en España.
Tu trabajo es validar, clasificar y normalizar datos de activos importados desde un Excel.

Para cada activo que recibas:
1. **Validar**: detecta incoherencias (CP no coincide con la provincia, campos obligatorios vacíos, direcciones incompletas, precios sospechosos — 0€ o >50M€).
2. **Clasificar tipología** (campo "tip") — normaliza al valor más adecuado entre: Vivienda, Parking, Trastero, Local, Nave, Oficina, Suelo, Edificio, Comercial. Asigna el código "tipC" correspondiente: tp-viv, tp-park, tp-tras, tp-local, tp-nave, tp-ofi, tp-suelo, tp-edif, tp-com.
3. **Clasificar fase judicial** (campo "fase") — normaliza usando los textos libres de ejud/ejmap/eneg. Códigos: fp-pub (publicada/convocada subasta), fp-sus (suspendida/pendiente), fp-seg (seguimiento), fp-res (reserva/negociación), fp-nd (no determinada).
4. **Normalizar provincia** — corrige errores tipográficos comunes (ej. "Madrdi" → "Madrid").
5. **Normalizar CP** — verifica que sea de 5 dígitos y coherente con la provincia.

Responde SOLO con un JSON válido (sin markdown, sin \`\`\`) con esta estructura exacta:
{
  "assets": [
    {
      "id": "string",
      "tip": "string o null si no hay corrección",
      "tipC": "string o null",
      "fase": "string o null",
      "faseC": "string o null",
      "prov": "string o null",
      "cp": "string o null",
      "warnings": ["lista de advertencias"]
    }
  ],
  "summary": "Resumen global: X válidos, Y con advertencias, Z con errores críticos"
}

Si un campo no necesita corrección, ponlo como null.
Si no hay advertencias para un activo, devuelve warnings como array vacío.`;

function slimAsset(a: Asset): Record<string, unknown> {
  return {
    id: a.id,
    tip: a.tip,
    tipC: a.tipC,
    fase: a.fase,
    faseC: a.faseC,
    prov: a.prov,
    cp: a.cp,
    pob: a.pob,
    addr: a.addr,
    precio: a.precio,
    ejud: a.adm.ejud,
    ejmap: a.adm.ejmap,
    eneg: a.adm.eneg,
    tcol: a.adm.tcol,
    scol: a.adm.scol,
  };
}

/**
 * Extrae el primer objeto JSON balanceado del texto. Robusto frente a:
 *  - prefijos como "Aquí está el JSON: ..."
 *  - bloques fenced ```json ... ```
 *  - llaves dentro de strings JSON
 *
 * Devuelve null si no encuentra un objeto balanceado.
 */
function extractFirstJsonObject(text: string): string | null {
  // Try fenced code block first
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;

  let depth = 0;
  let start = -1;
  let inString = false;
  let escape = false;
  for (let i = 0; i < candidate.length; i++) {
    const c = candidate[i];
    if (escape) { escape = false; continue; }
    if (c === "\\" && inString) { escape = true; continue; }
    if (c === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (c === "{") {
      if (depth === 0) start = i;
      depth++;
    } else if (c === "}") {
      depth--;
      if (depth === 0 && start !== -1) {
        return candidate.slice(start, i + 1);
      }
    }
  }
  return null;
}

async function callClaude(assets: Record<string, unknown>[]): Promise<ClaudeValidationResult> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY no configurada");

  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      // 8192 da margen suficiente para lotes de hasta ~25 activos con
      // warnings + summary sin truncarse a la mitad del JSON.
      max_tokens: 8192,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Valida y clasifica estos ${assets.length} activos inmobiliarios:\n\n${JSON.stringify(assets, null, 0)}`,
        },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Claude API ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = await res.json();
  const stopReason: string | undefined = data.stop_reason;
  const text: string = data.content?.[0]?.text ?? "";

  if (stopReason === "max_tokens") {
    throw new Error(
      `Respuesta IA truncada por max_tokens. Reduce el tamaño del lote (AI_BATCH_SIZE en UploadActivosModal) o sube max_tokens.`,
    );
  }

  const json = extractFirstJsonObject(text);
  if (!json) throw new Error("Claude no devolvió un objeto JSON balanceado");

  try {
    return JSON.parse(json) as ClaudeValidationResult;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`JSON inválido en respuesta IA: ${msg}`);
  }
}

/**
 * Validates a single batch of assets with Claude. The client calls this in a loop
 * to get per-batch progress. Returns partial results per batch.
 */
export async function validateAssetsBatch(
  assets: Asset[],
): Promise<{
  results: ClaudeAssetResult[];
  summary: string;
  error?: string;
}> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return { results: [], summary: "", error: "ANTHROPIC_API_KEY no configurada" };
  }
  try {
    const slim = assets.map(slimAsset);
    const result = await callClaude(slim);
    return { results: result.assets, summary: result.summary };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { results: [], summary: "", error: msg };
  }
}

function applyCorrections(
  assets: Asset[],
  allResults: ClaudeAssetResult[],
): Asset[] {
  const correctionMap = new Map<string, ClaudeAssetResult>();
  for (const r of allResults) correctionMap.set(r.id, r);

  return assets.map((a) => {
    const c = correctionMap.get(a.id);
    if (!c) return a;
    return {
      ...a,
      tip: c.tip ?? a.tip,
      tipC: c.tipC ?? a.tipC,
      fase: c.fase ?? a.fase,
      faseC: c.faseC ?? a.faseC,
      prov: c.prov ?? a.prov,
      cp: c.cp ?? a.cp,
    };
  });
}

export async function validateAndEnrichWithClaude(
  assets: Asset[],
): Promise<{ assets: Asset[]; result: ClaudeValidationResult }> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return {
      assets,
      result: { assets: [], summary: "Validación IA omitida: ANTHROPIC_API_KEY no configurada." },
    };
  }

  const batches: Record<string, unknown>[][] = [];
  for (let i = 0; i < assets.length; i += BATCH_SIZE) {
    batches.push(assets.slice(i, i + BATCH_SIZE).map(slimAsset));
  }

  const allResults: ClaudeAssetResult[] = [];
  const summaries: string[] = [];

  for (const batch of batches) {
    try {
      const result = await callClaude(batch);
      allResults.push(...result.assets);
      summaries.push(result.summary);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      summaries.push(`Error en lote: ${msg}`);
    }
  }

  const enriched = applyCorrections(assets, allResults);

  const combinedResult: ClaudeValidationResult = {
    assets: allResults,
    summary: summaries.join(" | "),
  };

  return { assets: enriched, result: combinedResult };
}
