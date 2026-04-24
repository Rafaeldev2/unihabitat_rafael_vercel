"use client";

import { useState, useMemo } from "react";
import { useApp } from "@/lib/context";
import { fmt, fmtM } from "@/lib/utils";
import Link from "next/link";
import type { Asset } from "@/lib/types";
import { Search, Star, X, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown, Plus, Check, Trash2 } from "lucide-react";
import { UploadActivosModal } from "./UploadActivosModal";
import { DashboardVendedor } from "./DashboardVendedor";
import { FilterSelect } from "@/components/FilterSelect";
import { deleteAllAssets, deleteAssetsByIds } from "@/app/actions/assets";

type SortCol = "prov" | "pob" | "sqm" | "precio" | "cat" | "addr" | "cp" | "tip" | "fase";

const pillClass: Record<string, string> = {
  "tp-viv": "bg-blue/8 text-blue",
  "tp-park": "bg-[#5a7a8a]/8 text-[#5a7a8a]",
  "tp-tras": "bg-muted/8 text-muted",
  "tp-local": "bg-orange/8 text-orange",
  "fp-pub": "bg-green/8 text-green",
  "fp-sus": "bg-red/8 text-red",
  "fp-seg": "bg-blue/8 text-blue",
  "fp-res": "bg-orange/8 text-orange",
  "fp-nd": "bg-muted/8 text-muted",
};

export default function ActivosPage() {
  const { assets, toggleFav, toggleChk, toggleChkAll, session, clearAssets, removeAssetsByIds } = useApp();

  if (session?.role === "vendedor") return <DashboardVendedor />;
  const [uploadOpen, setUploadOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [q, setQ] = useState("");
  const [fCat, setFCat] = useState("");
  const [fProv, setFProv] = useState("");
  const [fPob, setFPob] = useState("");
  const [fTipo, setFTipo] = useState("");
  const [fFase, setFFase] = useState("");
  const [favOnly, setFavOnly] = useState(false);
  const [sortCol, setSortCol] = useState<SortCol>("prov");
  const [sortDir, setSortDir] = useState<1 | -1>(1);

  const filtered = useMemo(() => {
    let res = assets.filter(a => {
      if (fCat && a.cat !== fCat) return false;
      if (fProv && a.prov !== fProv) return false;
      if (fPob && a.pob !== fPob) return false;
      if (fTipo && a.tip !== fTipo) return false;
      if (fFase && a.fase !== fFase) return false;
      if (favOnly && !a.fav) return false;
      if (q) {
        const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
        const blob = [
          a.id, a.cat, a.prov, a.pob, a.cp, a.ccaa,
          a.addr, a.fullAddr, a.tvia, a.nvia, a.num,
          a.tip, a.bien, a.clase, a.uso,
          a.catRef, a.ownerName,
          a.fase, String(a.precio || ""), String(a.sqm || ""),
          a.adm.aid, a.adm.id1, a.adm.con, a.adm.pip, a.adm.cref,
          a.adm.car, a.adm.cli, a.adm.finca, a.adm.reg,
        ].filter(Boolean).join(" ").toLowerCase();
        if (!terms.every(t => blob.includes(t))) return false;
      }
      return true;
    });
    res.sort((a, b) => {
      const va = a[sortCol as keyof Asset];
      const vb = b[sortCol as keyof Asset];
      if (va === null || va === undefined) return sortDir;
      if (vb === null || vb === undefined) return -sortDir;
      if (typeof va === "string" && typeof vb === "string") return va.localeCompare(vb) * sortDir;
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * sortDir;
      return 0;
    });
    return res;
  }, [assets, q, fCat, fProv, fPob, fTipo, fFase, favOnly, sortCol, sortDir]);

  const handleSort = (col: SortCol) => {
    if (sortCol === col) setSortDir(d => d === 1 ? -1 : 1);
    else { setSortCol(col); setSortDir(1); }
  };

  const clearFilters = () => {
    setQ(""); setFCat(""); setFProv(""); setFPob(""); setFTipo(""); setFFase("");
    if (favOnly) setFavOnly(false);
  };

  const handleDeleteAll = async () => {
    if (!window.confirm("¿Estás seguro de que deseas BORRAR TODOS los activos?\n\nEsta acción es irreversible y eliminará también mensajes, notas, documentos y oportunidades asociados.")) return;
    if (!window.confirm("CONFIRMACIÓN FINAL: Se borrarán " + assets.length + " activos y todos sus datos asociados.\n\n¿Continuar?")) return;
    setDeleting(true);
    try {
      const { deleted } = await deleteAllAssets();
      clearAssets();
      window.alert(`${deleted} activo(s) eliminados correctamente.`);
    } catch (err) {
      window.alert("Error al borrar: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setDeleting(false);
    }
  };

  const selectedInFiltered = useMemo(() => filtered.filter(a => a.chk).map(a => a.id), [filtered]);
  const selectedCount = selectedInFiltered.length;

  const handleDeleteSelected = async () => {
    if (selectedCount === 0) return;
    if (!window.confirm(`¿Eliminar ${selectedCount} activo(s) seleccionado(s)?\n\nSe borrarán también mensajes, notas, documentos y oportunidades asociados.`)) return;
    setDeleting(true);
    try {
      const { deleted } = await deleteAssetsByIds(selectedInFiltered);
      removeAssetsByIds(selectedInFiltered);
      try {
        window.dispatchEvent(new Event("propcrm-assets-updated"));
      } catch { /* ignore */ }
      window.alert(`${deleted} activo(s) eliminados correctamente.`);
    } catch (err) {
      window.alert("Error al borrar: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setDeleting(false);
    }
  };

  const allChk = filtered.length > 0 && filtered.every(a => a.chk);

  const SortIcon = ({ col }: { col: SortCol }) => {
    if (sortCol !== col) return <ArrowUpDown size={11} className="opacity-40" />;
    return sortDir === 1 ? <ArrowUp size={11} /> : <ArrowDown size={11} />;
  };

  return (
    <>
      <UploadActivosModal open={uploadOpen} onClose={() => setUploadOpen(false)} />
      {/* Topbar */}
      <div className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-white px-6">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold text-navy">Propiedades</h1>
          <span className="rounded-md bg-cream px-2.5 py-0.5 text-xs font-medium text-muted">{assets.length} activos</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-md bg-gold/10 px-2.5 py-1 text-xs font-medium text-gold">{session?.role === "admin" ? "Admin" : "Vendedor"}</span>
          <button
            type="button"
            onClick={() => setUploadOpen(true)}
            className="flex items-center gap-1.5 rounded-lg bg-navy px-3.5 py-2 text-xs font-medium text-white transition-colors hover:bg-navy3"
          >
            <Plus size={14} /> Nuevo Activo
          </button>
        </div>
      </div>

      <div className="p-5">
        {/* Search */}
        <div className="relative mb-3">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            className="w-full rounded-lg border border-border bg-white py-2.5 pl-9 pr-4 text-sm text-text shadow-sm outline-none transition-all placeholder:text-muted/70 focus:border-navy focus:ring-2 focus:ring-navy/5"
            placeholder="Buscar por dirección, municipio, referencia, cartera, tipología..."
            value={q}
            onChange={e => setQ(e.target.value)}
          />
        </div>

        {/* Filters */}
        <div className="mb-3 rounded-lg border border-border bg-white p-3.5 shadow-sm">
          <div className="flex flex-wrap items-end gap-2.5">
            <FilterSelect label="Categoría" value={fCat} onChange={setFCat} options={["NPL", "REO"]} />
            <FilterSelect label="Provincia" value={fProv} onChange={setFProv} options={[...new Set(assets.map(a => a.prov))]} />
            <FilterSelect label="Población" value={fPob} onChange={setFPob} options={[...new Set(assets.map(a => a.pob))]} />
            <FilterSelect label="Tipología" value={fTipo} onChange={setFTipo} options={["Vivienda", "Garaje", "Trastero", "Comercial", "Casa / Chalet", "Piso", "Nave", "Oficina", "Suelo", "Edificio"]} />
            <FilterSelect label="Situación" value={fFase} onChange={setFFase} options={["Publicado", "Suspendido"]} />
            <div className="flex min-w-[90px] flex-col gap-1">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted">Favoritos</label>
              <button
                onClick={() => setFavOnly(!favOnly)}
                className={`flex items-center gap-1.5 rounded-md border px-3 py-[7px] text-xs font-medium transition-all ${favOnly ? "border-gold/30 bg-gold/5 text-gold" : "border-border bg-cream2 text-muted"}`}
              >
                <Star size={12} className={favOnly ? "fill-gold" : ""} />
                {favOnly ? "Favoritos" : "Todos"}
              </button>
            </div>
            <div className="h-8 w-px self-end bg-border2" />
            <div className="flex gap-1.5 self-end">
              <button className="rounded-md bg-navy px-4 py-[7px] text-xs font-medium text-white hover:bg-navy3">Buscar</button>
              <button onClick={clearFilters} className="rounded-md border border-border px-2.5 py-[7px] text-muted transition-colors hover:border-red hover:text-red"><X size={14} /></button>
            </div>
          </div>
        </div>

        {/* Results bar */}
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 px-0.5">
          <p className="text-xs text-muted">Mostrando <strong className="font-semibold text-navy">{filtered.length}</strong> de {assets.length} activos</p>
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">Ordenar:</span>
            {([["prov", "Provincia"], ["pob", "Población"], ["sqm", "m²"], ["precio", "Precio"]] as const).map(([col, label]) => (
              <button
                key={col}
                onClick={() => handleSort(col)}
                className={`flex items-center gap-1 rounded-md border px-2.5 py-1 text-[11px] font-medium transition-all ${
                  sortCol === col ? "border-navy/20 bg-navy/5 text-navy" : "border-border bg-white text-muted hover:border-navy/20"
                }`}
              >
                {label} <SortIcon col={col} />
              </button>
            ))}
            <div className="mx-0.5 hidden h-4 w-px self-center bg-border2 sm:block" aria-hidden />
            <button
              type="button"
              onClick={handleDeleteSelected}
              disabled={deleting || selectedCount === 0}
              className="flex items-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-2.5 py-1 text-[11px] font-medium text-red-600 transition-colors hover:bg-red-100 disabled:opacity-40"
            >
              <Trash2 size={12} /> Borrar seleccionados{selectedCount > 0 ? ` (${selectedCount})` : ""}
            </button>
            <button
              type="button"
              onClick={handleDeleteAll}
              disabled={deleting || assets.length === 0}
              className="flex items-center gap-1.5 rounded-md border border-red-300 bg-white px-2.5 py-1 text-[11px] font-medium text-red-700 transition-colors hover:bg-red-50 disabled:opacity-40"
            >
              <Trash2 size={12} /> Borrar todos
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-lg border border-border bg-white shadow-sm">
          <div className="grid grid-cols-[32px_28px_72px_100px_100px_1fr_56px_56px_100px_minmax(7rem,1fr)_95px_28px] items-center gap-1.5 bg-navy px-3.5 py-2.5">
            <div
              className={`flex h-4 w-4 cursor-pointer items-center justify-center rounded-[3px] border-[1.5px] transition-all ${allChk ? "border-gold bg-gold text-white" : "border-white/25 hover:border-white/50"}`}
              onClick={() => toggleChkAll(filtered.map(a => a.id))}
            >{allChk && <Check size={10} strokeWidth={3} />}</div>
            <div />
            {(["cat","prov","pob","addr","cp","sqm","tip","fase","precio"] as SortCol[]).map(col => (
              <div key={col} className={`flex cursor-pointer select-none items-center gap-0.5 text-[10px] font-semibold uppercase tracking-wider transition-colors ${sortCol === col ? "text-gold" : "text-white/35 hover:text-white/60"}`} onClick={() => handleSort(col)}>
                {{cat:"Cat.",prov:"Provincia",pob:"Población",addr:"Dirección",cp:"C.P.",sqm:"m²",tip:"Tipo",fase:"Situación",precio:"Precio"}[col]}
              </div>
            ))}
            <div />
          </div>

          {filtered.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted">No se encontraron activos</div>
          ) : (
            filtered.map(a => (
              <Link
                key={a.id}
                href={`/admin/assets/${a.id}`}
                className="grid grid-cols-[32px_28px_72px_100px_100px_1fr_56px_56px_100px_minmax(7rem,1fr)_95px_28px] items-start gap-1.5 border-b border-border2 px-3.5 py-1.5 transition-colors last:border-b-0 hover:bg-cream/50 min-h-[46px]"
              >
                <div
                  className={`flex h-4 w-4 cursor-pointer items-center justify-center rounded-[3px] border-[1.5px] transition-all ${a.chk ? "border-navy bg-navy text-white" : "border-border hover:border-navy/40"}`}
                  onClick={e => { e.preventDefault(); e.stopPropagation(); toggleChk(a.id); }}
                >{a.chk && <Check size={10} strokeWidth={3} />}</div>
                <div
                  className="cursor-pointer"
                  onClick={e => { e.preventDefault(); e.stopPropagation(); toggleFav(a.id); }}
                >
                  <Star size={14} className={`transition-all ${a.fav ? "fill-gold text-gold" : "text-border hover:text-gold/50"}`} />
                </div>
                <span className="truncate text-xs">{a.cat}</span>
                <span className="truncate text-xs">{a.prov}</span>
                <span className="truncate text-xs">{a.pob}</span>
                <span className="truncate text-xs text-muted">{a.addr}</span>
                <span className="font-mono text-[11px] text-muted">{a.cp}</span>
                <span className="text-xs text-muted">{fmtM(a.sqm)}</span>
                <span className={`inline-flex w-fit rounded-md px-2 py-0.5 text-[10px] font-semibold ${pillClass[a.tipC] || ""}`}>{a.tip}</span>
                <span className={`min-w-0 max-w-full rounded-md px-2 py-0.5 text-left text-[10px] font-semibold leading-snug whitespace-normal break-words ${pillClass[a.faseC] || ""}`}>{a.fase}</span>
                <span className="text-sm font-semibold text-navy">{fmt(a.precio)}</span>
                <ChevronRight size={14} className="text-border" />
              </Link>
            ))
          )}
        </div>

        {/* Pagination */}
        <div className="mt-3 flex items-center justify-between px-0.5">
          <p className="text-xs text-muted">Página 1 de 1</p>
          <div className="flex gap-1">
            <button className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-white text-xs text-muted">&lsaquo;</button>
            <button className="flex h-7 w-7 items-center justify-center rounded-md bg-navy text-xs font-semibold text-white">1</button>
            <button className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-white text-xs text-muted">&rsaquo;</button>
          </div>
        </div>
      </div>
    </>
  );
}
