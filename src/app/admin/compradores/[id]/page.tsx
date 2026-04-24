"use client";

import { use, useState } from "react";
import { useApp } from "@/lib/context";
import { chatMessages } from "@/lib/mock-data";
import Link from "next/link";
import type { Comprador } from "@/lib/types";
import { User, FolderOpen, MessageSquare, ArrowLeft, Upload, FileText, Download, Send, Save, Plus } from "lucide-react";

const tabs = [
  { icon: User, label: "Datos" },
  { icon: FolderOpen, label: "Documentos" },
  { icon: MessageSquare, label: "Conversación" },
];

export default function CompradorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { getComprador } = useApp();
  const c = getComprador(id);
  const [tab, setTab] = useState(0);

  if (!c) return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted">
      <User size={40} strokeWidth={1} className="text-border" />
      <p className="text-base font-medium">Comprador no encontrado</p>
      <Link href="/admin/compradores" className="text-sm text-gold hover:underline">Volver</Link>
    </div>
  );

  return (
    <>
      <div className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-white px-6">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold text-navy">{c.nombre}</h1>
          <span className="rounded-md bg-cream px-2.5 py-0.5 text-xs text-muted">{c.id}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-md bg-gold/10 px-2.5 py-1 text-xs font-medium text-gold">Admin</span>
          <Link href="/admin/compradores" className="flex items-center gap-1.5 rounded-lg border border-border bg-white px-3.5 py-2 text-xs font-medium text-navy hover:bg-cream"><ArrowLeft size={14} /> Volver</Link>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden" style={{ height: "calc(100vh - 56px)" }}>
        <div className="flex w-44 min-w-[176px] flex-col bg-navy py-3">
          {tabs.map((t, i) => {
            const Icon = t.icon;
            return (
              <button key={i} onClick={() => setTab(i)} className={`flex items-center gap-2.5 border-l-[3px] px-4 py-2.5 text-left transition-all ${tab === i ? "border-l-gold bg-white/[0.06] text-gold" : "border-l-transparent text-white/35 hover:bg-white/[0.03] hover:text-white/60"}`}>
                <Icon size={15} strokeWidth={1.5} />
                <span className="text-xs font-medium">{t.label}</span>
              </button>
            );
          })}
        </div>
        <div className="flex-1 overflow-y-auto bg-cream p-6">
          {tab === 0 && <TabDatos c={c} />}
          {tab === 1 && <TabDocs />}
          {tab === 2 && <TabConversacion />}
        </div>
      </div>
    </>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[1.5px] text-gold after:h-px after:flex-1 after:bg-border">{title}</div>
      {children}
    </div>
  );
}

function DataPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-cream2 px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted">{label}</div>
      <div className="text-sm text-text">{value}</div>
    </div>
  );
}

function TabDatos({ c }: { c: Comprador }) {
  return (
    <>
      <div className="mb-4 rounded-lg bg-gradient-to-br from-navy to-navy3 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full text-sm font-bold text-white" style={{ background: `linear-gradient(135deg,${c.col})` }}>{c.ini}</div>
          <div className="flex-1">
            <div className="text-base font-semibold text-white">{c.nombre}</div>
            <div className="text-xs text-white/40">{c.tipo} · NDA {c.nda} · {c.id}</div>
          </div>
          <span className="rounded-md bg-white/10 px-2.5 py-1 text-xs font-medium text-gold">{c.estado}</span>
        </div>
      </div>

      <div className="mb-4"><SectionCard title="Información de Contacto">
        <div className="grid grid-cols-3 gap-2">
          <DataPill label="Teléfono" value={c.tel} />
          <DataPill label="Email" value={c.email} />
          <DataPill label="Agente asignado" value={c.agente} />
        </div>
      </SectionCard></div>

      <div className="mb-4"><SectionCard title="Perfil de Búsqueda">
        <div className="grid grid-cols-3 gap-2">
          <DataPill label="Intereses" value={c.intereses} />
          <DataPill label="Presupuesto" value={c.presupuesto} />
          <DataPill label="Activos vinculados" value={c.activos} />
          <DataPill label="Financiación" value="Sí — Banco Santander" />
          <DataPill label="Sup. mínima" value="80 m²" />
          <DataPill label="Zona" value="Andalucía preferente" />
        </div>
      </SectionCard></div>

      <div className="mb-4"><SectionCard title="Historial de Ofertas">
        <div className="flex items-center gap-3 rounded-md border border-border bg-cream2 p-3">
          <FileText size={16} className="flex-shrink-0 text-blue" />
          <div className="flex-1">
            <div className="text-sm font-medium text-navy">Oferta sobre activo 20257589 (Arriate)</div>
            <div className="text-[11px] text-muted">95.000 € · Presentada el 28 Feb 2026</div>
          </div>
          <span className="rounded-md bg-blue/8 px-2 py-0.5 text-[10px] font-semibold text-blue">En negociación</span>
        </div>
      </SectionCard></div>

      <SectionCard title="Notas internas">
        <textarea className="w-full rounded-md border border-border bg-cream2 p-3 text-sm text-text outline-none focus:border-navy" rows={3} placeholder="Añade notas sobre este comprador..." />
        <div className="mt-2 flex justify-end">
          <button className="flex items-center gap-1.5 rounded-md bg-gold px-3 py-1.5 text-xs font-medium text-white hover:bg-gold2"><Save size={12} /> Guardar</button>
        </div>
      </SectionCard>
    </>
  );
}

function TabDocs() {
  return (
    <>
      <div className="mb-4 flex cursor-pointer flex-col items-center rounded-lg border-2 border-dashed border-border bg-cream2 p-6 hover:border-navy/30">
        <Upload size={24} className="mb-2 text-muted" />
        <p className="text-sm text-muted"><span className="font-medium text-text">Arrastra archivos</span> o haz clic</p>
      </div>
      {[{ name: "NDA_Firmada_JRG.pdf", meta: "Admin · 250 KB · 15 Feb 2026" }, { name: "Documentos_identidad.pdf", meta: "Admin · 1.5 MB · 10 Feb 2026" }].map((d, i) => (
        <div key={i} className="mb-2 flex items-center gap-3 rounded-lg border border-border bg-white p-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-cream2 text-red"><FileText size={16} /></div>
          <div className="flex-1">
            <div className="text-sm font-medium text-navy">{d.name}</div>
            <div className="text-[11px] text-muted">{d.meta}</div>
          </div>
          <button className="flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-navy hover:bg-cream"><Download size={12} /></button>
        </div>
      ))}
    </>
  );
}

function TabConversacion() {
  return (
    <>
      <div className="flex max-h-[400px] flex-col gap-2 overflow-y-auto">
        {chatMessages.map((m, i) => (
          <div key={i} className={`max-w-[76%] rounded-lg px-3 py-2 text-sm leading-relaxed ${
            m.from === "cli" ? "self-start bg-white text-text" : "self-end bg-navy text-white"
          }`}>
            {m.text}
            <div className={`mt-0.5 text-[10px] ${m.from === "cli" ? "text-muted" : "text-right text-white/40"}`}>{m.time}</div>
          </div>
        ))}
      </div>
      <div className="mt-4 flex gap-2">
        <textarea className="flex-1 rounded-md border border-border p-2.5 text-sm outline-none focus:border-navy" rows={2} placeholder="Escribe un mensaje..." />
        <button className="flex items-center gap-1 self-end rounded-md bg-gold px-3.5 py-2.5 text-xs font-medium text-white hover:bg-gold2"><Send size={12} /></button>
      </div>
    </>
  );
}
