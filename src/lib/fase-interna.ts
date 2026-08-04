/** Enum fijo de Situación / Fase Interna (negocio Unihabitat). */
export const FASE_INTERNA_OPTIONS = [
  "Disponible",
  "Seguimiento",
  "Info. Solicitada",
  "Ofertado",
  "Negociación",
  "Reservado",
  "Cerrado",
  "No Disponible",
] as const;

function fold(s: unknown): string {
  if (s == null) return "";
  return String(s)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();
}

/**
 * Mapea "Fase Interna" (texto libre) a un código de fase.
 * Enum negocio: Disponible, Seguimiento, Info. Solicitada, Ofertado,
 * Negociación, Reservado, Cerrado, No Disponible.
 */
export function faseToCode(fase: string): string {
  const f = fold(fase);
  if (!f) return "";
  if (/NO\s*DISPONIBLE|NODISPONIBLE/.test(f)) return "fp-nd";
  if (/DISPONIBLE|PUB/.test(f)) return "fp-pub";
  if (/SUSPEND|PAUS/.test(f)) return "fp-sus";
  if (/SEGUIMIENTO|EN PROCESO/.test(f)) return "fp-seg";
  if (/INFO\.?\s*SOLICITADA|INFOSOLICITADA/.test(f)) return "fp-info";
  if (/OFERTAD/.test(f)) return "fp-ofe";
  if (/NEGOCIA/.test(f)) return "fp-neg";
  if (/RESERVA/.test(f)) return "fp-res";
  if (/CERRAD/.test(f)) return "fp-cer";
  return "fp-nd";
}
