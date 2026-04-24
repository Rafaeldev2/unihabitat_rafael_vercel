"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useApp } from "@/lib/context";
import { fmt, fmtM, shortAddr } from "@/lib/utils";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Search, MapPin, Building, SlidersHorizontal, X,
  ArrowUpDown,
  Ruler, Tag, Layers,
} from "lucide-react";
import { Suspense } from "react";
import { FilterSelect } from "@/components/FilterSelect";
import { InteractiveMap } from "@/components/InteractiveMap";
import { usePortalAuth } from "@/hooks/usePortalAuth";

type SortKey = "none" | "price_asc" | "price_desc" | "sqm_asc" | "sqm_desc" | "pob_az";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "none", label: "Sin ordenar" },
  { value: "price_asc", label: "Precio: menor a mayor" },
  { value: "price_desc", label: "Precio: mayor a menor" },
  { value: "sqm_asc", label: "Superficie: menor a mayor" },
  { value: "sqm_desc", label: "Superficie: mayor a menor" },
  { value: "pob_az", label: "Población: A → Z" },
];

function PortalContent() {
  const { assets } = useApp();
  const { sensitiveVisible } = usePortalAuth();
  const searchParams = useSearchParams();
  const publicAssets = useMemo(() => assets.filter(a => a.pub), [assets]);

  const [q, setQ] = useState(searchParams.get("pob") ?? "");
  const [fCat, setFCat] = useState(searchParams.get("cat") ?? "");
  const [fProv, setFProv] = useState(searchParams.get("prov") ?? "");
  const [fPob, setFPob] = useState("");
  const [fTipo, setFTipo] = useState(searchParams.get("tipo") ?? "");
  const [sortBy, setSortBy] = useState<SortKey>("none");

  useEffect(() => {
    setQ(searchParams.get("pob") ?? "");
    setFProv(searchParams.get("prov") ?? "");
    setFTipo(searchParams.get("tipo") ?? "");
    setFCat(searchParams.get("cat") ?? "");
  }, [searchParams]);

  const filtered = useMemo(() => {
    const terms = q.toLowerCase().split(/\s+/).filter(Boolean);

    const result = publicAssets.filter(a => {
      if (fCat && a.cat !== fCat) return false;
      if (fProv && a.prov !== fProv) return false;
      if (fPob && a.pob !== fPob) return false;
      if (fTipo && a.tip !== fTipo) return false;
      if (terms.length === 0) return true;

      const searchable = [
        a.id, a.pob, a.prov, a.cp, a.ccaa,
        a.addr, a.fullAddr, a.tvia, a.nvia, a.num,
        a.tip, a.cat, a.bien, a.clase, a.uso,
        ...(sensitiveVisible ? [a.catRef, a.ownerName] : []),
        a.precio != null ? String(a.precio) : "",
        a.adm.aid, a.adm.id1, a.adm.con, a.adm.pip, a.adm.cref,
        a.adm.car, a.adm.cli, a.adm.finca, a.adm.reg,
      ].filter(Boolean).join(" ").toLowerCase();

      return terms.every(t => searchable.includes(t));
    });

    if (sortBy === "price_asc") result.sort((a, b) => (a.precio ?? Infinity) - (b.precio ?? Infinity));
    else if (sortBy === "price_desc") result.sort((a, b) => (b.precio ?? 0) - (a.precio ?? 0));
    else if (sortBy === "sqm_asc") result.sort((a, b) => (a.sqm ?? Infinity) - (b.sqm ?? Infinity));
    else if (sortBy === "sqm_desc") result.sort((a, b) => (b.sqm ?? 0) - (a.sqm ?? 0));
    else if (sortBy === "pob_az") result.sort((a, b) => (a.pob || "").localeCompare(b.pob || ""));

    return result;
  }, [publicAssets, q, fCat, fProv, fPob, fTipo, sortBy, sensitiveVisible]);

  const hasFilters = Boolean(q || fCat || fProv || fPob || fTipo);

  const clearFilters = useCallback(() => {
    setQ(""); setFCat(""); setFProv(""); setFPob(""); setFTipo("");
  }, []);

  // Stats
  const stats = useMemo(() => {
    const provs = new Set(publicAssets.map(a => a.prov).filter(Boolean));
    const pobs = new Set(publicAssets.map(a => a.pob).filter(Boolean));
    return { total: publicAssets.length, provincias: provs.size, poblaciones: pobs.size };
  }, [publicAssets]);

  // Group assets by contract ID for "X inmuebles asociados" badge
  const groupsByContract = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const a of publicAssets) {
      const con = a.adm.con;
      if (con && con !== "—" && con.trim()) {
        if (!map[con]) map[con] = [];
        map[con].push(a.id);
      }
    }
    return map;
  }, [publicAssets]);

  return (
    <div className="mx-auto max-w-7xl px-6 pb-16 pt-8">
      {/* ── Hero ── */}
      <div className="mb-10 overflow-hidden rounded-2xl bg-gradient-to-br from-navy via-navy3 to-navy p-8 md:p-12">
        <div className="max-w-2xl">
          <h1 className="text-2xl font-bold text-white md:text-3xl">
            Encuentra tu próxima oportunidad inmobiliaria
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-white/50">
            Explora nuestra selección de activos NPL y REO. Propiedades verificadas con información catastral completa.
          </p>
        </div>

        <div className="mt-6 flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
            <input
              className="w-full rounded-lg border border-white/10 bg-white/10 py-2.5 pl-10 pr-4 text-sm text-white outline-none placeholder:text-white/40 focus:border-gold/50 focus:ring-2 focus:ring-gold/10"
              placeholder="Buscar por ref. catastral, municipio, provincia, dirección, ID, cartera..."
              value={q}
              onChange={e => setQ(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            {([
              fCat ? { label: fCat, clear: () => setFCat("") } : null,
              fTipo ? { label: fTipo, clear: () => setFTipo("") } : null,
              fProv ? { label: fProv, clear: () => setFProv("") } : null,
            ] as const).filter((c): c is { label: string; clear: () => void } => c !== null)
              .map((chip) => (
                <span key={chip.label} className="flex items-center gap-1 rounded-full bg-gold/20 px-3 py-1.5 text-xs font-medium text-gold">
                  {chip.label}
                  <button type="button" onClick={chip.clear}><X size={11} /></button>
                </span>
              ))}
          </div>
        </div>

        {/* Stats */}
        <div className="mt-6 flex gap-8">
          <div>
            <div className="text-2xl font-bold text-white">{stats.total}</div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-white/40">Propiedades</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-white">{stats.provincias}</div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-white/40">Provincias</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-white">{stats.poblaciones}</div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-white/40">Poblaciones</div>
          </div>
        </div>

        {/* ── Filter bar (dentro del hero) ── */}
        <div className="mt-6 w-full max-w-full rounded-lg border border-border bg-white p-3.5 shadow-sm">
          <div className="flex flex-wrap items-end gap-2.5">
            <FilterSelect label="Categoría" value={fCat} onChange={setFCat} options={["CDR", "NPL", "REO"]} />
            <FilterSelect
              label="Provincia"
              value={fProv}
              onChange={setFProv}
              options={[...new Set(publicAssets.map(a => a.prov).filter(Boolean))].sort((a, b) => a.localeCompare(b))}
            />
            <FilterSelect
              label="Población"
              value={fPob}
              onChange={setFPob}
              options={[...new Set(publicAssets.map(a => a.pob).filter(Boolean))].sort((a, b) => a.localeCompare(b))}
            />
            <FilterSelect
              label="Tipología"
              value={fTipo}
              onChange={setFTipo}
              options={["Vivienda", "Garaje", "Trastero", "Comercial", "Casa / Chalet", "Piso", "Nave", "Oficina", "Suelo", "Edificio"]}
            />
            <div className="h-8 w-px self-end bg-border2" />
            <div className="flex gap-1.5 self-end">
              <button
                type="button"
                onClick={clearFilters}
                className="rounded-md border border-border px-2.5 py-[7px] text-muted transition-colors hover:border-red hover:text-red"
                aria-label="Limpiar filtros"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Results bar with sort ── */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted">
          <span className="font-semibold text-navy">{filtered.length}</span>{" "}
          {filtered.length === 1 ? "propiedad publicada" : "propiedades publicadas"}
          {hasFilters && <span> · filtros activos</span>}
        </p>
        <div className="flex items-center gap-3">
          {hasFilters && (
            <button type="button" onClick={clearFilters} className="flex items-center gap-1 text-xs font-medium text-muted hover:text-navy">
              <X size={12} /> Limpiar
            </button>
          )}
          <div className="flex items-center gap-1.5">
            <ArrowUpDown size={12} className="text-muted" />
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as SortKey)}
              className="cursor-pointer appearance-none rounded-md border border-border bg-white px-2.5 py-1.5 text-xs text-text outline-none transition-all focus:border-navy"
            >
              {SORT_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ── Property grid ── */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(a => (
            <Link
              key={a.id}
              href={`/portal/${a.id}`}
              className="group overflow-hidden rounded-xl border border-border bg-white shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5"
            >
              {/* Image + badges */}
              <div className="relative">
                <InteractiveMap
                  lat={a.lat}
                  lng={a.lng}
                  mapImageUrl={a.map}
                  label={a.pob && a.pob !== "—" ? a.pob : undefined}
                  className="h-[180px] w-full transition-transform group-hover:scale-[1.02]"
                />
                {/* NPL / REO badge */}
                <div className="absolute left-3 top-3 flex gap-1.5">
                  {a.cat && (
                    <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                      a.cat === "NPL"
                        ? "bg-amber-500/90 text-white"
                        : "bg-emerald-600/90 text-white"
                    }`}>
                      {a.cat}
                    </span>
                  )}
                  {a.tip && (
                    <span className="rounded-md bg-black/50 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm">
                      {a.tip}
                    </span>
                  )}
                </div>
                {/* Collateral group badge */}
                {groupsByContract[a.adm.con]?.length > 1 && (
                  <div className="absolute bottom-3 left-3">
                    <span className="flex items-center gap-1 rounded-md bg-navy/85 px-2 py-1 text-[10px] font-semibold text-white backdrop-blur-sm">
                      <Layers size={11} />
                      {groupsByContract[a.adm.con].length} inmuebles asociados al {a.cat || "NPL"}
                    </span>
                  </div>
                )}
              </div>

              {/* Card content */}
              <div className="p-4">
                <div className="mb-1 flex items-center gap-1.5 text-[11px] text-muted">
                  <MapPin size={11} className="shrink-0" />
                  <span className="truncate">{a.pob}, {a.prov}</span>
                  {a.cp && <span className="shrink-0 text-border">· {a.cp}</span>}
                </div>
                <h3 className="truncate text-sm font-semibold text-navy">{shortAddr(a)}</h3>

                {/* Details row */}
                <div className="mt-2.5 flex items-center gap-3 text-[11px] text-muted">
                  {a.sqm && (
                    <span className="flex items-center gap-1">
                      <Ruler size={11} /> {fmtM(a.sqm)}
                    </span>
                  )}
                  {sensitiveVisible && a.catRef && (
                    <span className="flex items-center gap-1 truncate">
                      <Tag size={10} />
                      <span className="max-w-[120px] truncate font-mono text-[10px]">{a.catRef}</span>
                    </span>
                  )}
                </div>

                {/* Price */}
                <div className="mt-3 flex items-end justify-between border-t border-border/50 pt-3">
                  <span className="text-lg font-bold text-navy">{a.precio ? fmt(a.precio) : "Haz tu Oferta"}</span>
                  {a.sqm && a.precio ? (
                    <span className="text-[10px] text-muted">
                      {Math.round(a.precio / a.sqm).toLocaleString("es-ES")} €/m²
                    </span>
                  ) : null}
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="py-20 text-center">
          <Building size={40} strokeWidth={1} className="mx-auto text-border" />
          <p className="mt-3 text-sm font-medium text-navy">No hay propiedades que coincidan</p>
          <p className="mt-1 text-xs text-muted">Prueba a ajustar los filtros de búsqueda</p>
          {hasFilters && (
            <button onClick={clearFilters} className="mx-auto mt-4 flex items-center gap-1.5 text-xs font-semibold text-gold hover:text-gold2">
              <SlidersHorizontal size={12} /> Limpiar todos los filtros
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function PortalPage() {
  return (
    <Suspense>
      <PortalContent />
    </Suspense>
  );
}
