"use client";

import { useState, useEffect } from "react";
import { fetchPublicAssets, fetchAssetsByIds } from "@/app/actions/assets";
import { backfillMissingMaps } from "@/app/actions/maps";
import { fetchInvitedAssetIds } from "@/app/actions/invitations";
import { signOut } from "@/app/login/actions";
import type { Asset } from "@/lib/types";
import { fmt, fmtM, shortAddr } from "@/lib/utils";
import { shouldBackfillMapFromAddress } from "@/lib/map-default";
import Link from "next/link";
import { Building, MapPin, LogIn, LogOut, FileText, Star } from "lucide-react";
import { InteractiveMap } from "@/components/InteractiveMap";

export default function PortalPrivadoPage() {
  const [publicAssets, setPublicAssets] = useState<Asset[]>([]);
  const [invitedAssets, setInvitedAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  async function handleLogout() {
    await signOut();
  }

  useEffect(() => {
    let cid: string | null = null;
    const devCookie = document.cookie.split("; ").find(c => c.startsWith("dev-auth="));
    if (devCookie) {
      try {
        const dev = JSON.parse(decodeURIComponent(devCookie.split("=").slice(1).join("=")));
        setUserEmail(dev.email ?? null);
        cid = dev.compradorId ?? dev.comprador_id ?? null;
      } catch { /* ignore */ }
    }

    const loadPublic = (async () => {
      const data = await fetchPublicAssets();
      const needMap = data.filter((a) => shouldBackfillMapFromAddress(a));
      let next = data;
      if (needMap.length > 0) {
        const stubs = needMap.map((a) => ({
          id: a.id,
          addr: a.addr,
          pob: a.pob,
          prov: a.prov,
          cp: a.cp,
        }));
        try {
          const hits = await backfillMissingMaps(stubs);
          next = data.map((a) => {
            const h = hits[a.id];
            if (!h) return a;
            return { ...a, map: h.map, lat: h.lat, lng: h.lng };
          });
        } catch {
          /* mantener data inicial */
        }
      }
      setPublicAssets(next);
    })();

    const loadInvited = cid
      ? fetchInvitedAssetIds(cid).then(async (ids) => {
          if (ids.length === 0) return;
          const assets = await fetchAssetsByIds(ids);
          setInvitedAssets(assets);
        })
      : Promise.resolve();

    Promise.all([loadPublic, loadInvited])
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-gold border-t-transparent" /></div>;

  if (!userEmail) return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
      <div className="rounded-xl border border-border bg-white p-8 text-center shadow-sm">
        <h2 className="mb-2 text-lg font-semibold text-navy">Acceso requerido</h2>
        <p className="mb-6 text-sm text-muted">Inicia sesion para acceder a la zona privada</p>
        <div className="flex items-center justify-center gap-3">
          <Link href="/login?redirect=/portal/privado" className="flex items-center gap-2 rounded-lg bg-navy px-4 py-2.5 text-sm font-medium text-white hover:bg-navy3">
            <LogIn size={14} /> Iniciar sesion
          </Link>
          <button onClick={handleLogout} className="flex items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-navy hover:bg-cream">
            <LogOut size={14} /> Cerrar sesion actual
          </button>
        </div>
      </div>
    </div>
  );

  const allPublicIds = new Set(publicAssets.map(a => a.id));
  const exclusiveInvited = invitedAssets.filter(a => !allPublicIds.has(a.id));
  const totalAssets = publicAssets.length + exclusiveInvited.length;

  const AssetCard = ({ a, badge }: { a: Asset; badge?: string }) => (
    <Link href={`/portal/privado/${a.id}`} className="group overflow-hidden rounded-xl border border-border bg-white shadow-sm transition-all hover:shadow-md">
      <div className="relative">
        <InteractiveMap
          lat={a.lat}
          lng={a.lng}
          mapImageUrl={a.map}
          label={a.pob && a.pob !== "—" ? a.pob : undefined}
          className="h-[160px] w-full transition-transform group-hover:scale-[1.02]"
        />
        {badge && (
          <span className="absolute left-2 top-2 flex items-center gap-1 rounded-md bg-gold/90 px-2 py-0.5 text-[10px] font-semibold text-white">
            <Star size={10} /> {badge}
          </span>
        )}
      </div>
      <div className="p-4">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="rounded-md bg-navy/5 px-2 py-0.5 text-[10px] font-semibold text-navy">{a.tip}</span>
          <span className="flex items-center gap-1 text-[11px] text-muted"><MapPin size={10} /> {a.cp}</span>
        </div>
        <h3 className="text-base font-semibold text-navy">{a.pob}, {a.prov}</h3>
        <p className="mt-0.5 truncate text-xs text-muted">{shortAddr(a)}</p>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-lg font-bold text-navy">{a.precio ? fmt(a.precio) : "Haz tu Oferta"}</span>
          {a.sqm && <span className="text-xs text-muted">{fmtM(a.sqm)}</span>}
        </div>
      </div>
    </Link>
  );

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <div className="mb-8 rounded-xl bg-gradient-to-br from-navy to-navy3 p-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Mi Zona Privada</h1>
            <p className="mt-1 text-sm text-white/40">Acceso a tus activos y propiedades disponibles</p>
          </div>
          <button onClick={handleLogout} className="flex items-center gap-2 rounded-lg border border-white/20 px-4 py-2 text-sm font-medium text-white hover:bg-white/10">
            <LogOut size={14} /> Salir
          </button>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-3 gap-4">
        <div className="rounded-lg border border-border bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold/10 text-gold"><Building size={20} /></div>
            <div>
              <div className="text-2xl font-bold text-navy">{totalAssets}</div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted">Activos disponibles</div>
            </div>
          </div>
        </div>
        {exclusiveInvited.length > 0 && (
          <div className="rounded-lg border border-gold/30 bg-gold/5 p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold/10 text-gold"><Star size={20} /></div>
              <div>
                <div className="text-2xl font-bold text-gold">{exclusiveInvited.length}</div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted">Compartidos contigo</div>
              </div>
            </div>
          </div>
        )}
        <Link href="/portal/privado/ofertas" className="rounded-lg border border-border bg-white p-5 shadow-sm transition-all hover:shadow-md">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-navy/10 text-navy"><FileText size={20} /></div>
            <div>
              <div className="text-sm font-semibold text-navy">Mis Ofertas</div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted">Ver y gestionar</div>
            </div>
          </div>
        </Link>
      </div>

      {exclusiveInvited.length > 0 && (
        <>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gold">
            <Star size={14} /> Activos compartidos contigo
          </h2>
          <div className="mb-8 grid grid-cols-3 gap-5">
            {exclusiveInvited.map(a => <AssetCard key={a.id} a={a} badge="Para ti" />)}
          </div>
        </>
      )}

      <h2 className="mb-3 text-sm font-semibold text-navy">Propiedades disponibles</h2>
      <div className="grid grid-cols-3 gap-5">
        {publicAssets.map(a => <AssetCard key={a.id} a={a} />)}
      </div>

      {totalAssets === 0 && (
        <div className="py-16 text-center">
          <Building size={40} className="mx-auto mb-3 text-border" />
          <p className="text-sm text-muted">No hay propiedades publicadas en este momento</p>
        </div>
      )}
    </div>
  );
}
