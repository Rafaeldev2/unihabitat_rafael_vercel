/**
 * Consulta DNP por referencia catastral (API JSON del Catastro).
 * Lógica alineada con catastro.py → get_catastro_data (sin coordenadas ESCatastroLib).
 */

export type Json = Record<string, unknown> | unknown[] | string | number | boolean | null;

const DNP_URL =
  "https://ovc.catastro.meh.es/OVCServWeb/OVCWcfCallejero/COVCCallejero.svc/json/Consulta_DNPRC";

const TRANSIENT_HTTP_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);
const MAX_RETRIES = 2; // total: 3 intentos
const RETRY_BASE_MS = 600;

function isTransientError(msg: string): boolean {
  const m = msg.toLowerCase();
  return (
    m.includes("abort") ||
    m.includes("timeout") ||
    m.includes("tiempo de espera") ||
    m.includes("fetch failed") ||
    m.includes("network") ||
    m.includes("econnreset") ||
    m.includes("econnrefused") ||
    m.includes("enotfound") ||
    m.includes("etimedout") ||
    m.includes("socket hang up")
  );
}

function sleepDnp(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

export interface CatastroDnprcParsed {
  referencia: string;
  clase: string;
  uso: string;
  bien: string;
  provincia: string;
  municipio: string;
  codigoPostal: string;
  direccionCompleta: string;
  tipoVia: string;
  nombreVia: string;
  numero: string;
  escalera: string;
  planta: string;
  puerta: string;
  superficieConstruida: string;
  superficieGrafica: string;
  antiguedad: string;
  coeficiente: string;
  descripcion: string;
  error: string;
}

function str(v: unknown): string {
  if (v == null || v === "") return "";
  return String(v).trim();
}

/** Navega objetos/listas anidados (equivalente a safe_get de catastro.py). */
export function dig(obj: unknown, ...path: (string | number)[]): unknown {
  let cur: unknown = obj;
  for (const key of path) {
    if (cur == null) return undefined;
    if (typeof key === "number" && Array.isArray(cur)) {
      cur = key < cur.length ? cur[key] : undefined;
    } else if (typeof key === "string" && typeof cur === "object" && !Array.isArray(cur)) {
      cur = (cur as Record<string, unknown>)[key];
    } else {
      return undefined;
    }
  }
  return cur;
}

export function safeGet(obj: unknown, ...keys: (string | number)[]): string {
  const cur = dig(obj, ...keys);
  if (cur == null || cur === "") return "";
  if (typeof cur === "object") return "";
  return str(cur);
}

function traducirValor(valor: string, tipo: "planta" | "puerta", tipoBienPrincipal: string): string {
  if (tipo === "planta") {
    if (tipoBienPrincipal !== "VIVIENDA UNIFAMILIAR") {
      return ["OD", "00", ""].includes(valor) || !valor ? "00" : valor;
    }
    return "";
  }
  if (tipo === "puerta") {
    return ["OS", "00", ""].includes(valor) || !valor ? "" : valor;
  }
  return valor || "";
}

function asList(v: unknown): Json[] {
  if (v == null) return [];
  if (Array.isArray(v)) return v as Json[];
  return [v as Json];
}

function emptyResult(ref: string, error: string): CatastroDnprcParsed {
  return {
    referencia: ref,
    clase: "",
    uso: "",
    bien: "",
    provincia: "",
    municipio: "",
    codigoPostal: "",
    direccionCompleta: "",
    tipoVia: "",
    nombreVia: "",
    numero: "",
    escalera: "",
    planta: "",
    puerta: "",
    superficieConstruida: "",
    superficieGrafica: "",
    antiguedad: "",
    coeficiente: "",
    descripcion: "",
    error,
  };
}

/** Normaliza referencia catastral para la API (sin guiones/espacios raros). */
export function normalizeCadastralRef(raw: string): string {
  const t = raw.replace(/\s+/g, "").replace(/-/g, "").toUpperCase();
  return t;
}

/** Indica si merece la pena llamar al Catastro. */
export function isPlausibleCadastralRef(raw: string): boolean {
  const n = normalizeCadastralRef(raw);
  if (!n || n === "—") return false;
  if (n.length < 14 || n.length > 25) return false;
  return /^[0-9A-Z]+$/i.test(n);
}

/**
 * Resultado interno: además del parsed, indica si la causa de error es
 * transitoria (vale la pena reintentar) o permanente. Sólo se usa dentro de
 * fetchConsultaDnprc para decidir el retry; el caller externo recibe siempre
 * CatastroDnprcParsed con `error` (string vacío si OK).
 */
type DnpAttempt = { parsed: CatastroDnprcParsed; transient: boolean };

async function fetchConsultaDnprcOnce(ref: string): Promise<DnpAttempt> {
  const url = `${DNP_URL}?RefCat=${encodeURIComponent(ref)}`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; PropCRM/1.0)" },
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    });
    if (!res.ok) {
      const transient = TRANSIENT_HTTP_STATUSES.has(res.status);
      return { parsed: emptyResult(ref, `HTTP ${res.status}`), transient };
    }
    const data = (await res.json()) as Record<string, unknown>;

    if (!("consulta_dnprcResult" in data)) {
      return {
        parsed: emptyResult(ref, `Estructura no reconocida. Claves: ${Object.keys(data).join(", ")}`),
        transient: false,
      };
    }

    const root = data.consulta_dnprcResult as Record<string, unknown>;
    const bico = (root.bico ?? {}) as Record<string, unknown>;
    const bi = (bico.bi ?? {}) as Record<string, unknown>;
    const finca = (bico.finca ?? {}) as Record<string, unknown>;

    if (!bi || Object.keys(bi).length === 0) {
      return {
        parsed: emptyResult(ref, "No se encontró información del bien inmueble"),
        transient: false,
      };
    }

    const idbi = (bi.idbi ?? {}) as Record<string, unknown>;
    const cn = str(idbi.cn);

    let clase = cn;
    if (cn === "UR") clase = "URBANO";
    else if (cn === "RU") clase = "RÚSTICO";

    const dt = (bi.dt ?? {}) as Record<string, unknown>;
    const provincia = str(dt.np);
    const municipio = str(dt.nm);
    const ldt = str(bi.ldt);
    const direccionCompleta = ldt
      .replace(/Localización:\s*/gi, "")
      .replace(/^Localización$/i, "")
      .trim();

    const locs = (dig(dt, "locs") as Record<string, unknown> | undefined) ?? {};
    const lous = (locs.lous ?? {}) as Record<string, unknown>;
    const lourb = (lous.lourb ?? {}) as Record<string, unknown>;
    const dirUrbana = (lourb.dir ?? {}) as Record<string, unknown>;
    const loint = (lourb.loint ?? {}) as Record<string, unknown>;
    const tipoVia = str(dirUrbana.tv);
    const nombreVia = str(dirUrbana.nv);
    const numero = str(dirUrbana.pnp);
    const escalera = str(loint.es);
    const planta = str(loint.pt);
    const puerta = str(loint.pu);
    const dp = lourb.dp != null ? str(lourb.dp) : "";

    const debi = (bi.debi ?? {}) as Record<string, unknown>;
    const uso = str(debi.luso);
    let superficieConstruida = str(debi.sfc);
    const antiguedad = str(debi.ant);
    let coefPart = str(debi.cpt);
    if (coefPart) {
      const n = parseFloat(coefPart.replace(",", "."));
      if (!Number.isNaN(n)) coefPart = `${n.toFixed(2)}%`;
    }

    const dff = (finca.dff ?? {}) as Record<string, unknown>;
    let superficieGrafica = str(dff.ss);
    if (!superficieGrafica) superficieGrafica = safeGet(idbi, "sg");
    if (!superficieGrafica) superficieGrafica = safeGet(bi, "sg");

    if (!superficieGrafica && cn === "RU") {
      const lspr = bico.lspr;
      if (lspr && typeof lspr === "object" && !Array.isArray(lspr)) {
        let spr: unknown = (lspr as Record<string, unknown>).spr;
        if (Array.isArray(spr) && spr.length) spr = spr[0];
        if (spr && typeof spr === "object") {
          const dspr = ((spr as Record<string, unknown>).dspr ?? {}) as Record<string, unknown>;
          superficieGrafica = safeGet(dspr, "ssp");
        }
      }
    }

    const lcons: Json[] = asList(bico.lcons);

    let tipoBienPrincipal = "";
    for (const u of lcons) {
      const dtip = safeGet(u, "dvcons", "dtip");
      if (dtip && dtip.toUpperCase().includes("VIVIENDA UNIFAMILIAR")) {
        tipoBienPrincipal = "VIVIENDA UNIFAMILIAR";
        break;
      }
    }
    if (!tipoBienPrincipal) {
      for (const u of lcons) {
        const dtip = safeGet(u, "dvcons", "dtip");
        if (dtip && dtip.toUpperCase().includes("VIVIENDA COLECTIVA")) {
          tipoBienPrincipal = "VIVIENDA COLECTIVA";
          break;
        }
      }
    }
    if (!tipoBienPrincipal) {
      for (const u of lcons) {
        const lcd = safeGet(u, "lcd");
        const dtip = safeGet(u, "dvcons", "dtip");
        if (lcd && lcd.toUpperCase().includes("VIVIENDA")) {
          tipoBienPrincipal = dtip || "VIVIENDA";
          break;
        }
      }
    }
    if (!tipoBienPrincipal && uso.toUpperCase().includes("RESIDENCIAL")) {
      tipoBienPrincipal = "RESIDENCIAL";
    }
    if (!tipoBienPrincipal && lcons.length) {
      tipoBienPrincipal = safeGet(lcons[0], "dvcons", "dtip");
    }

    const unidadesList: string[] = [];
    for (const u of lcons) {
      const lcd = safeGet(u, "lcd");
      const stl = safeGet(u, "dfcons", "stl");
      const dtip = safeGet(u, "dvcons", "dtip");
      if (lcd || stl || dtip) {
        unidadesList.push(`${lcd} - ${stl} m² (${dtip})`);
      }
    }
    const descripcion = unidadesList.join("\n");

    const plantaFinal = traducirValor(planta, "planta", tipoBienPrincipal);
    const puertaFinal = traducirValor(puerta, "puerta", tipoBienPrincipal);

    return {
      parsed: {
        referencia: ref,
        clase,
        uso,
        bien: tipoBienPrincipal,
        provincia,
        municipio,
        codigoPostal: dp,
        direccionCompleta,
        tipoVia,
        nombreVia,
        numero,
        escalera,
        planta: plantaFinal,
        puerta: puertaFinal,
        superficieConstruida,
        superficieGrafica,
        antiguedad,
        coeficiente: coefPart,
        descripcion,
        error: "",
      },
      transient: false,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("abort") || msg.includes("Timeout")) {
      return {
        parsed: emptyResult(ref, "Error de conexión: tiempo de espera agotado"),
        transient: true,
      };
    }
    return {
      parsed: emptyResult(ref, `Error al procesar: ${msg}`),
      transient: isTransientError(msg),
    };
  }
}

export async function fetchConsultaDnprc(refCat: string): Promise<CatastroDnprcParsed> {
  const ref = normalizeCadastralRef(refCat);
  if (!isPlausibleCadastralRef(ref)) {
    return emptyResult(ref, "Referencia catastral no válida o ausente");
  }

  let last: DnpAttempt | null = null;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    last = await fetchConsultaDnprcOnce(ref);
    if (!last.parsed.error) return last.parsed;
    if (!last.transient || attempt === MAX_RETRIES) return last.parsed;
    const backoff = RETRY_BASE_MS * Math.pow(2, attempt) + Math.floor(Math.random() * 200);
    await sleepDnp(backoff);
  }
  return (last ?? { parsed: emptyResult(ref, "Sin respuesta"), transient: false }).parsed;
}
