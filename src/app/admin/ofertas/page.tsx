"use client";

import { useState, useEffect } from "react";
import { useApp } from "@/lib/context";
import { fetchOfertasPendientes, updateOfertaEstado, type OfertaRow } from "@/app/actions/ofertas";
import { fetchCompradores } from "@/app/actions/compradores";
import { fetchAssetById } from "@/app/actions/assets";
import type { Asset, Comprador } from "@/lib/types";
import Link from "next/link";
import { FileText, CheckCircle2, XCircle, Send, Loader2, AlertCircle, Euro } from "lucide-react";
import { fmt } from "@/lib/utils";

export default function OfertasPage() {
  const { assets } = useApp();
  const [ofertas, setOfertas] = useState<OfertaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [compradores, setCompradores] = useState<Map<string, Comprador>>(new Map());
  const [assetsMap, setAssetsMap] = useState<Map<string, Asset>>(new Map());

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [ofertasData, compradoresData] = await Promise.all([
        fetchOfertasPendientes(),
        fetchCompradores(),
      ]);
      setOfertas(ofertasData);
      const compMap = new Map<string, Comprador>();
      compradoresData.forEach(c => compMap.set(c.id, c));
      setCompradores(compMap);

      // Cargar assets
      const assetIds = [...new Set(ofertasData.map(o => o.asset_id))];
      const assetPromises = assetIds.map(id => fetchAssetById(id));
      const assetResults = await Promise.all(assetPromises);
      const assetMap = new Map<string, Asset>();
      assetResults.forEach(a => { if (a) assetMap.set(a.id, a); });
      setAssetsMap(assetMap);
    } catch (err) {
      console.error("Error loading ofertas:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleEstadoChange(ofertaId: string, nuevoEstado: OfertaRow["estado"]) {
    try {
      await updateOfertaEstado(ofertaId, nuevoEstado);
      await loadData();
    } catch (err) {
      console.error("Error updating estado:", err);
      alert(err instanceof Error ? err.message : "Error al actualizar estado");
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 size={32} className="animate-spin text-gold" />
      </div>
    );
  }

  return (
    <>
      <div className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-white px-6">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold text-navy">Ofertas de Compradores</h1>
          <span className="rounded-md bg-cream px-2.5 py-0.5 text-xs font-medium text-muted">
            {ofertas.length} {ofertas.length === 1 ? "oferta" : "ofertas"}
          </span>
        </div>
      </div>

      <div className="p-5">
        {ofertas.length === 0 ? (
          <div className="py-16 text-center">
            <FileText size={40} className="mx-auto mb-3 text-border" />
            <p className="text-sm text-muted">No hay ofertas pendientes</p>
          </div>
        ) : (
          <div className="space-y-3">
            {ofertas.map(oferta => {
              const comprador = compradores.get(oferta.comprador_id);
              const asset = assetsMap.get(oferta.asset_id);
              if (!comprador || !asset) return null;

              const estadoColors: Record<OfertaRow["estado"], string> = {
                pendiente: "bg-blue/10 text-blue",
                validada: "bg-green/10 text-green",
                rechazada: "bg-red/10 text-red",
                nda_enviado: "bg-gold/10 text-gold",
                nda_firmado: "bg-green/10 text-green",
              };

              return (
                <div
                  key={oferta.id}
                  className="rounded-lg border border-border bg-white p-5 shadow-sm"
                >
                  <div className="mb-4 flex items-start justify-between">
                    <div className="flex-1">
                      <div className="mb-2 flex items-center gap-3">
                        <div
                          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                          style={{ background: `linear-gradient(135deg,${comprador.col})` }}
                        >
                          {comprador.ini}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Link
                              href={`/admin/compradores/${comprador.id}`}
                              className="text-sm font-semibold text-navy hover:underline"
                            >
                              {comprador.nombre}
                            </Link>
                            <span className={`rounded-md px-2 py-0.5 text-[10px] font-semibold ${estadoColors[oferta.estado]}`}>
                              {oferta.estado.replace("_", " ")}
                            </span>
                          </div>
                          <div className="text-xs text-muted">{comprador.email}</div>
                        </div>
                      </div>
                      <div className="ml-12">
                        <Link
                          href={`/admin/assets/${asset.id}`}
                          className="text-sm font-medium text-navy hover:underline"
                        >
                          {asset.pob}, {asset.prov} — {asset.id}
                        </Link>
                        <div className="mt-1 flex items-center gap-4 text-xs text-muted">
                          <span>Tipo: {asset.tip}</span>
                          {asset.precio && <span>Precio estimado: {fmt(asset.precio)}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="ml-4 text-right">
                      <div className="mb-1 flex items-center gap-1.5 text-lg font-bold text-gold">
                        <Euro size={16} />
                        {oferta.propuesta_euros.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                      <div className="text-[10px] text-muted">
                        {new Date(oferta.created_at).toLocaleDateString("es-ES", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </div>
                  </div>

                  {oferta.comentarios && (
                    <div className="mb-4 ml-12 rounded-md bg-cream2 px-3 py-2">
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted mb-1">
                        Comentarios
                      </div>
                      <p className="text-xs text-text">{oferta.comentarios}</p>
                    </div>
                  )}

                  <div className="ml-12 flex flex-wrap gap-2">
                    {oferta.estado === "pendiente" && (
                      <>
                        <button
                          onClick={() => handleEstadoChange(oferta.id, "validada")}
                          className="flex items-center gap-1.5 rounded-lg bg-green px-3 py-1.5 text-xs font-medium text-white hover:bg-green/90"
                        >
                          <CheckCircle2 size={14} /> Validar
                        </button>
                        <button
                          onClick={() => handleEstadoChange(oferta.id, "rechazada")}
                          className="flex items-center gap-1.5 rounded-lg bg-red px-3 py-1.5 text-xs font-medium text-white hover:bg-red/90"
                        >
                          <XCircle size={14} /> Rechazar
                        </button>
                        <button
                          onClick={() => handleEstadoChange(oferta.id, "nda_enviado")}
                          className="flex items-center gap-1.5 rounded-lg bg-gold px-3 py-1.5 text-xs font-medium text-white hover:bg-gold2"
                        >
                          <Send size={14} /> Enviar NDA
                        </button>
                      </>
                    )}
                    {oferta.estado === "validada" && (
                      <button
                        onClick={() => handleEstadoChange(oferta.id, "nda_enviado")}
                        className="flex items-center gap-1.5 rounded-lg bg-gold px-3 py-1.5 text-xs font-medium text-white hover:bg-gold2"
                      >
                        <Send size={14} /> Enviar NDA
                      </button>
                    )}
                    {oferta.estado === "nda_enviado" && (
                      <div className="flex items-center gap-2 rounded-lg bg-gold/10 px-3 py-1.5 text-xs text-gold">
                        <AlertCircle size={14} />
                        NDA enviado. Esperando firma del cliente.
                      </div>
                    )}
                    {oferta.estado === "nda_firmado" && (
                      <div className="flex items-center gap-2 rounded-lg bg-green/10 px-3 py-1.5 text-xs text-green">
                        <CheckCircle2 size={14} />
                        NDA firmado el {new Date(oferta.nda_firmado_at!).toLocaleDateString("es-ES")}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
