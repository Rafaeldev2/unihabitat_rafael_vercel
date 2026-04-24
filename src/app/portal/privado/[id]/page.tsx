"use client";

import { use, useState, useEffect } from "react";
import { fetchAssetById } from "@/app/actions/assets";
import type { Asset } from "@/lib/types";
import { fmt, fmtM } from "@/lib/utils";
import Link from "next/link";
import { ArrowLeft, FileText, MessageSquare, FolderOpen } from "lucide-react";
import { InteractiveMap } from "@/components/InteractiveMap";

export default function PortalPrivadoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [asset, setAsset] = useState<Asset | null>(null);
  const [tab, setTab] = useState<"info" | "chat" | "docs">("info");

  useEffect(() => {
    fetchAssetById(id).then((data) => {
      if (data) setAsset(data);
    });
  }, [id]);

  if (!asset) return <div className="flex min-h-[60vh] items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-gold border-t-transparent" /></div>;

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <Link href="/portal/privado" className="mb-5 inline-flex items-center gap-1.5 text-xs font-medium text-muted hover:text-navy"><ArrowLeft size={14} /> Volver a mi zona</Link>

      <div className="mb-5 flex gap-2 border-b border-border">
        {([["info", "Informacion", FileText], ["chat", "Mensajes", MessageSquare], ["docs", "Documentos", FolderOpen]] as const).map(([key, lbl, Icon]) => (
          <button key={key} onClick={() => setTab(key)} className={`-mb-px flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-xs font-medium transition-all ${tab === key ? "border-b-navy text-navy" : "border-b-transparent text-muted hover:text-navy"}`}>
            <Icon size={14} /> {lbl}
          </button>
        ))}
      </div>

      {tab === "info" && (
        <div className="grid grid-cols-[1fr_280px] gap-6">
          <div>
            <InteractiveMap
              lat={asset.lat}
              lng={asset.lng}
              mapImageUrl={asset.map}
              label={asset.pob && asset.pob !== "—" ? asset.pob : undefined}
              className="mb-5 h-[260px] w-full rounded-xl border border-border"
            />
            <div className="rounded-lg border border-border bg-white p-5 shadow-sm">
              <div className="mb-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[1.5px] text-gold after:h-px after:flex-1 after:bg-border">Informacion completa</div>
              <div className="grid grid-cols-3 gap-2">
                <InfoPill label="Tipo" value={asset.bien} />
                <InfoPill label="Municipio" value={asset.pob} />
                <InfoPill label="Provincia" value={asset.prov} />
                <InfoPill label="CCAA" value={asset.ccaa} />
                <InfoPill label="C.P." value={asset.cp} />
                <InfoPill label="Superficie" value={asset.supC || fmtM(asset.sqm)} />
                <InfoPill label="Ref. Catastral" value={asset.catRef} />
                <InfoPill label="Clase" value={asset.clase} />
                <InfoPill label="Uso" value={asset.uso} />
              </div>
            </div>
            <div className="mt-4 rounded-lg border border-border bg-white p-5 shadow-sm">
              <div className="mb-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[1.5px] text-gold after:h-px after:flex-1 after:bg-border">Propietario</div>
              <div className="grid grid-cols-3 gap-2">
                <InfoPill label="Nombre" value={asset.ownerName} />
                <InfoPill label="Telefono" value={asset.ownerTel} />
                <InfoPill label="Email" value={asset.ownerMail} />
              </div>
            </div>
            <div className="mt-4 rounded-lg border border-border bg-white p-5 shadow-sm">
              <div className="mb-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[1.5px] text-gold after:h-px after:flex-1 after:bg-border">Descripcion</div>
              <p className="text-sm leading-[1.7] text-text">{asset.desc}</p>
            </div>
          </div>
          <div className="sticky top-20">
            <div className="rounded-lg border border-border bg-white p-5 shadow-sm">
              <div className="mb-1 text-2xl font-bold text-navy">{fmt(asset.precio)}</div>
              <div className="mb-1 text-[11px] text-muted">Precio estimado</div>
              {asset.sqm && asset.precio && <div className="mb-4 text-xs text-muted">{asset.sqm} m2 · {Math.round(asset.precio / asset.sqm).toLocaleString("es-ES")} euros/m2</div>}
              <button onClick={() => setTab("chat")} className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-navy py-3 text-xs font-medium text-white hover:bg-navy3"><MessageSquare size={13} /> Enviar mensaje</button>
            </div>
          </div>
        </div>
      )}

      {tab === "chat" && (
        <div className="rounded-lg border border-border bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <span className="text-xs font-semibold text-navy">Conversacion sobre {asset.pob} ({asset.id})</span>
          </div>
          <div className="flex max-h-[400px] flex-col gap-2 overflow-y-auto p-4">
            <p className="py-8 text-center text-sm text-muted">La funcionalidad de mensajeria estara disponible proximamente</p>
          </div>
        </div>
      )}

      {tab === "docs" && (
        <div>
          <div className="py-16 text-center">
            <FolderOpen size={40} className="mx-auto mb-3 text-border" />
            <p className="text-sm text-muted">No hay documentos compartidos contigo</p>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-cream2 px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted">{label}</div>
      <div className="text-sm text-text">{value}</div>
    </div>
  );
}
