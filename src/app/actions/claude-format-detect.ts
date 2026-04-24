"use server";

const API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-20250514";

export interface ColumnMapping {
  [colIndex: number]: string;
}

export interface FormatDetectionResult {
  mapping: ColumnMapping;
  confidence: number;
  description: string;
}

const ASSET_FIELDS = `Campos disponibles del tipo Asset (usa estos nombres exactos como valores del mapeo):
- id: identificador único del activo (obligatorio)
- cat: categoría
- prov: provincia
- pob: población/municipio
- cp: código postal (5 dígitos)
- addr: dirección
- tip: tipología (Vivienda, Parking, Trastero, Local, Nave, Oficina, Suelo, Edificio, Comercial)
- fase: fase judicial
- precio: precio o valor numérico
- sqm: metros cuadrados
- catRef: referencia catastral
- ccaa: comunidad autónoma
- fullAddr: dirección completa
- desc: descripción
- ownerName: nombre del propietario
- ownerTel: teléfono del propietario
- ownerMail: email del propietario
- tvia: tipo de vía
- nvia: nombre de vía
- num: número
- esc: escalera
- pla: planta
- pta: puerta
- clase: clase de inmueble
- uso: uso del inmueble
- bien: tipo de bien

Campos admin (prefija con "adm." para indicar que van al sub-objeto adm):
- adm.pip: ID Pipedrive
- adm.lin: ID LinkedIn
- adm.car: cartera
- adm.cli: cliente
- adm.con: contract ID
- adm.aid: asset ID
- adm.loans: número de préstamos
- adm.tcol: type of collateral
- adm.scol: subtype of collateral
- adm.cref: referencia catastral (admin)
- adm.ejud: estado judicial
- adm.ejmap: estado judicial mapeo
- adm.eneg: estado negociación
- adm.deu: deuda
- adm.dtot: deuda total
- adm.pest: precio estimado
- adm.str: estrategia
- adm.finca: número de finca
- adm.reg: número de registro`;

const SYSTEM_PROMPT = `Eres un asistente experto en importación de datos inmobiliarios NPL/REO en España.
Se te dará la cabecera y las primeras filas de un Excel cuyo formato no se ha podido detectar automáticamente.
Tu trabajo es deducir qué columna corresponde a cada campo del tipo Asset del CRM.

${ASSET_FIELDS}

Responde SOLO con un JSON válido (sin markdown, sin \`\`\`) con esta estructura:
{
  "mapping": { "0": "campo_asset", "1": "campo_asset", ... },
  "confidence": 0.85,
  "description": "Breve descripción del formato detectado"
}

Reglas:
- Solo incluye columnas que puedas mapear con confianza razonable.
- El campo "id" es obligatorio: si ninguna columna parece un ID único, elige la más adecuada (referencia, código, NDG, etc.).
- "confidence" es un número entre 0 y 1 indicando tu seguridad general en el mapeo.
- Si no puedes mapear el formato, devuelve {"mapping": {}, "confidence": 0, "description": "Formato no reconocido"}.`;

export async function detectFormatWithClaude(
  preview: { sheetName: string; rows: string[][] }[],
): Promise<FormatDetectionResult> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return { mapping: {}, confidence: 0, description: "ANTHROPIC_API_KEY no configurada" };
  }

  const sheetsText = preview
    .map(
      (sheet) =>
        `Hoja "${sheet.sheetName}":\n${sheet.rows.map((r, i) => `  Fila ${i}: ${JSON.stringify(r)}`).join("\n")}`,
    )
    .join("\n\n");

  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Analiza este Excel y sugiere un mapeo de columnas:\n\n${sheetsText}`,
        },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Claude API ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = await res.json();
  const text: string = data.content?.[0]?.text ?? "";

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return { mapping: {}, confidence: 0, description: "Claude no devolvió un mapeo válido" };
  }

  const parsed = JSON.parse(jsonMatch[0]) as FormatDetectionResult;

  const numericMapping: ColumnMapping = {};
  for (const [k, v] of Object.entries(parsed.mapping)) {
    numericMapping[parseInt(k, 10)] = v;
  }

  return {
    mapping: numericMapping,
    confidence: parsed.confidence ?? 0,
    description: parsed.description ?? "",
  };
}
