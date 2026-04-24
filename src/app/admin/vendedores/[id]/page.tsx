"use client";

import { use, useState, useEffect, useCallback } from "react";
import { useApp } from "@/lib/context";
import { chatMessages } from "@/lib/mock-data";
import Link from "next/link";
import type { Vendedor } from "@/lib/types";
import {
  User, FolderOpen, MessageSquare, ArrowLeft, Upload, FileText,
  Download, Send, Save, Mail, Phone, Shield, Building2,
  ShoppingCart, Loader2, CheckCircle,
} from "lucide-react";
import { ADMIN_SECTIONS, type VendorPermission, type SectionId } from "@/lib/permissions";
import {
  fetchVendorPermissions, upsertVendorPermissions,
  fetchVendorAssignedAssetIds, fetchVendorAssignedCompradorIds,
  assignAssetToVendor, unassignAssetFromVendor,
  assignCompradorToVendor, unassignCompradorFromVendor,
} from "@/app/actions/permissions";

const tabs = [
  { icon: User, label: "Datos" },
  { icon: Shield, label: "Permisos" },
  { icon: Building2, label: "Activos" },
  { icon: ShoppingCart, label: "Compradores" },
  { icon: FolderOpen, label: "Documentos" },
  { icon: MessageSquare, label: "Conversación" },
];

export default function VendedorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { getVendedor, assets, compradores, session } = useApp();
  const v = getVendedor(id);
  const [tab, setTab] = useState(0);

  if (!v) return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted">
      <User size={40} strokeWidth={1} className="text-border" />
      <p className="text-base font-medium">Vendedor no encontrado</p>
      <Link href="/admin/vendedores" className="text-sm text-gold hover:underline">Volver</Link>
    </div>
  );

  const isAdmin = session?.role === "admin";

  return (
    <>
      <div className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-white px-6">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold text-navy">{v.nombre}</h1>
          <span className="rounded-md bg-cream px-2.5 py-0.5 text-xs text-muted">{v.id}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-md bg-gold/10 px-2.5 py-1 text-xs font-medium text-gold">{isAdmin ? "Admin" : "Vendedor"}</span>
          <Link href="/admin/vendedores" className="flex items-center gap-1.5 rounded-lg border border-border bg-white px-3.5 py-2 text-xs font-medium text-navy hover:bg-cream"><ArrowLeft size={14} /> Volver</Link>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden" style={{ height: "calc(100vh - 56px)" }}>
        <div className="flex w-44 min-w-[176px] flex-col bg-navy py-3">
          {tabs.map((t, i) => {
            if (!isAdmin && (i === 1 || i === 2 || i === 3)) return null;
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
          {tab === 0 && <TabDatos v={v} />}
          {tab === 1 && isAdmin && <TabPermisos vendedorId={v.id} />}
          {tab === 2 && isAdmin && <TabActivosAsignados vendedorId={v.id} assets={assets} />}
          {tab === 3 && isAdmin && <TabCompradoresAsignados vendedorId={v.id} compradores={compradores} />}
          {tab === 4 && <TabDocs />}
          {tab === 5 && <TabConversacion />}
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

function PermToggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <div className={`relative h-5 w-10 cursor-pointer rounded-full transition-colors ${checked ? "bg-gold" : "bg-border"}`} onClick={onChange}>
      <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${checked ? "left-[22px]" : "left-0.5"}`} />
    </div>
  );
}

function TabDatos({ v }: { v: Vendedor }) {
  return (
    <>
      <div className="mb-4 rounded-lg bg-gradient-to-br from-navy to-navy3 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full text-sm font-bold text-white" style={{ background: `linear-gradient(135deg,${v.col})` }}>{v.ini}</div>
          <div className="flex-1">
            <div className="text-base font-semibold text-white">{v.nombre}</div>
            <div className="text-xs text-white/40">Cartera {v.cartera} · {v.id}</div>
          </div>
          <span className="rounded-md bg-white/10 px-2.5 py-1 text-xs font-medium text-gold">{v.estado}</span>
        </div>
      </div>

      <div className="mb-4"><SectionCard title="Información de Contacto">
        <div className="grid grid-cols-3 gap-2">
          <DataPill label="Teléfono" value={v.tel} />
          <DataPill label="Email" value={v.email} />
          <DataPill label="Agente asignado" value={v.agente} />
        </div>
      </SectionCard></div>

      <div className="mb-4"><SectionCard title="Activo Asociado">
        <div className="grid grid-cols-3 gap-2">
          <DataPill label="Activo" value={v.activo} />
          <DataPill label="Cartera" value={v.cartera} />
          <DataPill label="Último contacto" value={v.ultimo} />
        </div>
        <div className="mt-3 flex gap-2">
          <button className="flex items-center gap-1.5 rounded-md bg-gold px-3 py-1.5 text-xs font-medium text-white hover:bg-gold2"><Mail size={12} /> Enviar correo</button>
          <button className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-text hover:bg-cream"><Phone size={12} /> Registrar llamada</button>
        </div>
      </SectionCard></div>

      <SectionCard title="Notas internas">
        <textarea className="w-full rounded-md border border-border bg-cream2 p-3 text-sm text-text outline-none focus:border-navy" rows={3} placeholder="Añade notas sobre este vendedor..." />
        <div className="mt-2 flex justify-end">
          <button className="flex items-center gap-1.5 rounded-md bg-gold px-3 py-1.5 text-xs font-medium text-white hover:bg-gold2"><Save size={12} /> Guardar</button>
        </div>
      </SectionCard>
    </>
  );
}

function TabPermisos({ vendedorId }: { vendedorId: string }) {
  const [perms, setPerms] = useState<VendorPermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetchVendorPermissions(vendedorId).then(setPerms).finally(() => setLoading(false));
  }, [vendedorId]);

  const handleToggle = (section: SectionId, field: "canView" | "canEdit") => {
    setPerms((prev) =>
      prev.map((p) => {
        if (p.section !== section) return p;
        const updated = { ...p, [field]: !p[field] };
        if (field === "canView" && !updated.canView) updated.canEdit = false;
        if (field === "canEdit" && updated.canEdit) updated.canView = true;
        return updated;
      }),
    );
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    await upsertVendorPermissions(vendedorId, perms);
    setSaved(true);
    setSaving(false);
    setTimeout(() => setSaved(false), 2000);
  };

  if (loading) return <div className="flex items-center gap-2 py-8 text-muted"><Loader2 size={20} className="animate-spin" /> Cargando…</div>;

  return (
    <SectionCard title="Matriz de Permisos">
      <div className="rounded-md border border-border">
        <div className="flex items-center justify-between border-b border-border bg-cream2 px-4 py-2">
          <span className="text-xs font-semibold text-navy">Sección</span>
          <div className="flex gap-8 text-[10px] font-semibold uppercase tracking-wider text-muted">
            <span className="w-12 text-center">Ver</span>
            <span className="w-12 text-center">Editar</span>
          </div>
        </div>
        {ADMIN_SECTIONS.map((s) => {
          const perm = perms.find((p) => p.section === s.id);
          return (
            <div key={s.id} className="flex items-center justify-between border-b border-border px-4 py-2.5 last:border-b-0">
              <span className="text-sm text-text">{s.label}</span>
              <div className="flex gap-8">
                <div className="flex w-12 justify-center"><PermToggle checked={perm?.canView ?? false} onChange={() => handleToggle(s.id, "canView")} /></div>
                <div className="flex w-12 justify-center"><PermToggle checked={perm?.canEdit ?? false} onChange={() => handleToggle(s.id, "canEdit")} /></div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex justify-end">
        <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 rounded-lg bg-gold px-4 py-2 text-xs font-medium text-white hover:bg-gold2 disabled:opacity-50">
          {saving ? <Loader2 size={14} className="animate-spin" /> : saved ? <CheckCircle size={14} /> : <Save size={14} />}
          {saved ? "Guardado" : "Guardar"}
        </button>
      </div>
    </SectionCard>
  );
}

function TabActivosAsignados({ vendedorId, assets }: { vendedorId: string; assets: { id: string; prov: string; addr: string; pob: string }[] }) {
  const [assignedIds, setAssignedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const loadData = useCallback(() => {
    fetchVendorAssignedAssetIds(vendedorId).then(setAssignedIds).finally(() => setLoading(false));
  }, [vendedorId]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleToggle = async (assetId: string) => {
    if (assignedIds.includes(assetId)) {
      await unassignAssetFromVendor(vendedorId, assetId);
      setAssignedIds((prev) => prev.filter((id) => id !== assetId));
    } else {
      await assignAssetToVendor(vendedorId, assetId);
      setAssignedIds((prev) => [...prev, assetId]);
    }
  };

  const filtered = assets.filter((a) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return a.id.toLowerCase().includes(q) || a.prov.toLowerCase().includes(q) || a.addr.toLowerCase().includes(q);
  });

  if (loading) return <div className="flex items-center gap-2 py-8 text-muted"><Loader2 size={20} className="animate-spin" /> Cargando…</div>;

  return (
    <SectionCard title={`Activos asignados (${assignedIds.length})`}>
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Buscar activo por ID, provincia, dirección…"
        className="mb-3 w-full rounded-md border border-border bg-cream2 px-3 py-2 text-sm outline-none focus:border-navy"
      />
      <div className="max-h-80 overflow-y-auto rounded-md border border-border">
        {filtered.slice(0, 80).map((a) => (
          <label key={a.id} className="flex cursor-pointer items-center gap-2 border-b border-border px-3 py-2 last:border-b-0 hover:bg-cream2">
            <input type="checkbox" checked={assignedIds.includes(a.id)} onChange={() => handleToggle(a.id)} className="accent-gold" />
            <span className="flex-1 truncate text-xs text-text">
              <span className="font-medium">{a.id}</span> · {a.prov} · {a.addr !== "—" ? a.addr : a.pob}
            </span>
            {assignedIds.includes(a.id) && <span className="rounded bg-gold/10 px-1.5 py-0.5 text-[10px] font-semibold text-gold">Asignado</span>}
          </label>
        ))}
      </div>
    </SectionCard>
  );
}

function TabCompradoresAsignados({ vendedorId, compradores }: { vendedorId: string; compradores: { id: string; nombre: string; email: string }[] }) {
  const [assignedIds, setAssignedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const loadData = useCallback(() => {
    fetchVendorAssignedCompradorIds(vendedorId).then(setAssignedIds).finally(() => setLoading(false));
  }, [vendedorId]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleToggle = async (compId: string) => {
    if (assignedIds.includes(compId)) {
      await unassignCompradorFromVendor(vendedorId, compId);
      setAssignedIds((prev) => prev.filter((id) => id !== compId));
    } else {
      await assignCompradorToVendor(vendedorId, compId);
      setAssignedIds((prev) => [...prev, compId]);
    }
  };

  const filtered = compradores.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return c.nombre.toLowerCase().includes(q) || c.email.toLowerCase().includes(q);
  });

  if (loading) return <div className="flex items-center gap-2 py-8 text-muted"><Loader2 size={20} className="animate-spin" /> Cargando…</div>;

  return (
    <SectionCard title={`Compradores asignados (${assignedIds.length})`}>
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Buscar comprador por nombre o email…"
        className="mb-3 w-full rounded-md border border-border bg-cream2 px-3 py-2 text-sm outline-none focus:border-navy"
      />
      <div className="max-h-80 overflow-y-auto rounded-md border border-border">
        {filtered.map((c) => (
          <label key={c.id} className="flex cursor-pointer items-center gap-2 border-b border-border px-3 py-2 last:border-b-0 hover:bg-cream2">
            <input type="checkbox" checked={assignedIds.includes(c.id)} onChange={() => handleToggle(c.id)} className="accent-gold" />
            <span className="flex-1 truncate text-xs text-text">
              <span className="font-medium">{c.nombre}</span> · {c.email}
            </span>
            {assignedIds.includes(c.id) && <span className="rounded bg-gold/10 px-1.5 py-0.5 text-[10px] font-semibold text-gold">Asignado</span>}
          </label>
        ))}
      </div>
    </SectionCard>
  );
}

function TabDocs() {
  return (
    <>
      <div className="mb-4 flex cursor-pointer flex-col items-center rounded-lg border-2 border-dashed border-border bg-cream2 p-6 hover:border-navy/30">
        <Upload size={24} className="mb-2 text-muted" />
        <p className="text-sm text-muted"><span className="font-medium text-text">Arrastra archivos</span> o haz clic</p>
      </div>
      {[{ name: "Escritura_propiedad.pdf", meta: "Admin · 3.2 MB · 20 Feb 2026" }, { name: "IBI_2025.pdf", meta: "Admin · 180 KB · 15 Feb 2026" }].map((d, i) => (
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
        {chatMessages.slice(0, 3).map((m, i) => (
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
