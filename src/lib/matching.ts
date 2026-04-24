import type { Asset, Comprador } from "./types";

/**
 * Scores how well an asset matches a buyer's preferences.
 * Returns 0–100; higher = better match.
 */
export function scoreMatch(comprador: Comprador, asset: Asset): number {
  let score = 0;

  const intereses = comprador.intereses.toLowerCase();
  const presupuesto = parseFloat(comprador.presupuesto.replace(/[^\d]/g, "")) || Infinity;

  if (intereses.includes(asset.prov.toLowerCase())) score += 30;
  if (intereses.includes(asset.ccaa.toLowerCase())) score += 20;

  const tipKeywords: Record<string, string[]> = {
    "Vivienda": ["residencial", "vivienda", "piso", "primera vivienda"],
    "Parking": ["parking", "garaje", "plaza"],
    "Trastero": ["trastero", "almacen"],
    "Local": ["local", "comercial", "inversi"],
  };
  for (const [tipo, kws] of Object.entries(tipKeywords)) {
    if (asset.tip === tipo && kws.some(k => intereses.includes(k))) {
      score += 25;
      break;
    }
  }

  if (intereses.includes("inversi") || intereses.includes("cartera") || intereses.includes("npl")) {
    if (asset.cat === "NPL") score += 15;
  }

  if (asset.precio != null && asset.precio <= presupuesto) {
    const ratio = asset.precio / presupuesto;
    if (ratio >= 0.5) score += 20;
    else score += 10;
  } else if (asset.precio != null && asset.precio <= presupuesto * 1.2) {
    score += 5;
  }

  if (intereses.includes("costa") && ["Málaga", "Tarragona", "Barcelona", "Alicante", "Valencia", "Cádiz"].includes(asset.prov)) {
    score += 10;
  }

  return Math.min(score, 100);
}

export function findMatches(compradores: Comprador[], assets: Asset[], threshold = 25) {
  const matches: { compradorId: string; assetId: string; score: number }[] = [];
  for (const c of compradores) {
    for (const a of assets) {
      const s = scoreMatch(c, a);
      if (s >= threshold) matches.push({ compradorId: c.id, assetId: a.id, score: s });
    }
  }
  return matches.sort((a, b) => b.score - a.score);
}
