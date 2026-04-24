import type { Asset } from "@/lib/types";

function isEmptyStr(v: string | undefined | null): boolean {
  return v == null || v === "" || v === "—";
}

/**
 * Fusiona campos del Catastro / Enriquecido sin pisar datos ya informados en el Excel.
 */
export function mergePartialIntoAssetFillEmpty(asset: Asset, partial: Partial<Asset>): Asset {
  const next: Asset = { ...asset, adm: { ...asset.adm } };

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
    "catRef",
    "clase",
    "uso",
    "bien",
    "prov",
    "pob",
    "cp",
    "addr",
    "fullAddr",
    "tvia",
    "nvia",
    "num",
    "esc",
    "pla",
    "pta",
    "supC",
    "supG",
    "age",
    "coef",
    "desc",
    "map",
  ];
  for (const k of stringKeys) {
    assignIfEmpty(k, partial[k] as string | undefined);
  }
  assignIfEmpty("sqm", partial.sqm ?? undefined);

  const adm = next.adm;
  if (partial.catRef && isEmptyStr(adm.cref)) adm.cref = partial.catRef;
  if (partial.prov && isEmptyStr(adm.prov)) adm.prov = String(partial.prov).toUpperCase();
  if (partial.pob && isEmptyStr(adm.city)) adm.city = partial.pob;
  if (partial.cp && isEmptyStr(adm.zip)) adm.zip = partial.cp;
  if (partial.fullAddr && isEmptyStr(adm.addr)) adm.addr = partial.fullAddr;

  if (partial.fullAddr && isEmptyStr(next.addr)) next.addr = partial.fullAddr;

  return next;
}
