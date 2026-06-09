import type { Asset } from "@/lib/types";

function isEmptyStr(v: string | undefined | null): boolean {
  return v == null || v === "" || v === "—";
}

/**
 * Fusiona campos del Catastro / Enriquecido sin pisar datos ya informados.
 * Trabaja solo sobre el inmueble — los campos del propietario / fase ya no
 * viven en Asset.
 */
export function mergePartialIntoAssetFillEmpty(asset: Asset, partial: Partial<Asset>): Asset {
  const next: Asset = { ...asset };
  const rec = next as unknown as Record<string, unknown>;

  const assignIfEmpty = <K extends keyof Asset>(key: K, val: Asset[K] | undefined) => {
    if (val === undefined) return;
    const cur = next[key];
    if (typeof val === "string") {
      if (typeof cur === "string" && !isEmptyStr(cur)) return;
      rec[key as string] = val;
    } else if (key === "sqm") {
      if (next.sqm != null) return;
      next.sqm = val as number | null;
    }
  };

  const stringKeys: (keyof Asset)[] = [
    "clase", "uso", "bien", "prov", "pob", "cp", "addr", "fullAddr",
    "tvia", "nvia", "num", "esc", "pla", "pta",
    "supC", "supG", "age", "coef", "desc", "map",
  ];
  for (const k of stringKeys) {
    assignIfEmpty(k, partial[k] as string | undefined);
  }
  assignIfEmpty("sqm", partial.sqm ?? undefined);

  if (partial.fullAddr && isEmptyStr(next.addr)) next.addr = partial.fullAddr;
  return next;
}
