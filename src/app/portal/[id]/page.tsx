import Link from "next/link";
import { Lock } from "lucide-react";
import { fetchAssetById, fetchPublicAssets } from "@/app/actions/assets";
import PortalDetailClient from "./PortalDetailClient";

export default async function PortalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Leemos directamente de Supabase (cliente anónimo, RLS `assets_public_read`)
  // para que la "verdad" de `pub` no dependa del contexto cliente, que podía
  // estar a medio cargar o estar desincronizado tras publicar el activo.
  const asset = await fetchAssetById(id);

  if (!asset || !asset.pub) {
    return (
      <div className="mx-auto max-w-7xl px-6 py-20 text-center">
        <Lock size={40} strokeWidth={1} className="mx-auto text-border" />
        <p className="mt-3 text-sm text-muted">Esta propiedad no está disponible públicamente</p>
        <Link href="/portal" className="mt-3 inline-block text-sm text-gold hover:underline">Volver al listado</Link>
      </div>
    );
  }

  let siblings: Awaited<ReturnType<typeof fetchPublicAssets>> = [];
  const con = asset.adm.con;
  if (con && con !== "—" && con.trim()) {
    try {
      const all = await fetchPublicAssets();
      siblings = all.filter(a => a.id !== asset.id && a.adm.con === con);
    } catch {
      // El listado de colaterales es secundario: si falla, seguimos sin él.
      siblings = [];
    }
  }

  return <PortalDetailClient asset={asset} siblings={siblings} />;
}
