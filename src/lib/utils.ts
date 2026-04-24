import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function fmt(n: number | null): string {
  return n ? n.toLocaleString("es-ES") + " €" : "—";
}

/** Parsea texto de importe (es-ES: miles con punto, decimales con coma). */
export function parseLocaleMoneyInput(s: string): number | null {
  const t = s
    .trim()
    .replace(/\s/g, "")
    .replace(/€/g, "");
  if (!t) return null;
  if (t.includes(",")) {
    const n = parseFloat(t.replace(/\./g, "").replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  const parts = t.split(".");
  if (parts.length > 2) {
    const n = parseFloat(t.replace(/\./g, ""));
    return Number.isFinite(n) ? n : null;
  }
  if (parts.length === 2 && parts[1].length === 3) {
    if (parts[0] === "0") {
      const n0 = parseFloat(t);
      return Number.isFinite(n0) ? n0 : null;
    }
    const n = parseFloat(parts[0] + parts[1]);
    return Number.isFinite(n) ? n : null;
  }
  const n = parseFloat(t);
  return Number.isFinite(n) ? n : null;
}

export function fmtM(n: number | null): string {
  return n ? n + " m²" : "—";
}

export function shortAddr(a: { nvia?: string; pob?: string; prov?: string }): string {
  const via = a.nvia && a.nvia !== "—" ? a.nvia : "";
  return [via, a.pob, a.prov].filter(Boolean).join(", ") || a.pob || a.prov || "";
}
