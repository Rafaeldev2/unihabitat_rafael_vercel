import Link from "next/link";
import { redirect } from "next/navigation";
import { Lock } from "lucide-react";
import { fetchAssetById, fetchPublicAssetsByActivoId } from "@/app/actions/assets";
import { publicAssetPath } from "@/lib/public-slug";
import PortalDetailClient from "./PortalDetailClient";

/**
 * Ruta legacy `/portal/{id}` → redirige a `/portal/inmueble/{slug}` canónico.
 * Si aún no hay slug (migración pendiente), renderiza la ficha como fallback.
 */
export default async function PortalDetailLegacyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: raw } = await params;
  const id = decodeURIComponent(raw);

  const asset = await fetchAssetById(id);

  if (!asset || !asset.pub) {
    return (
      <div className="mx-auto max-w-7xl px-6 py-20 text-center">
        <Lock size={40} strokeWidth={1} className="mx-auto text-border" />
        <p className="mt-3 text-sm text-muted">Esta propiedad no está disponible públicamente</p>
        <Link href="/portal" className="mt-3 inline-block text-sm text-gold hover:underline">
          Volver al listado
        </Link>
      </div>
    );
  }

  if (asset.publicSlug) {
    redirect(publicAssetPath(asset.publicSlug));
  }

  let siblings: Awaited<ReturnType<typeof fetchPublicAssetsByActivoId>> = [];
  const activoId = asset.propiedades[0]?.activoId ?? "";
  if (activoId && activoId !== "—" && activoId.trim()) {
    try {
      const group = await fetchPublicAssetsByActivoId(activoId);
      siblings = group.filter((a) => a.id !== asset.id);
    } catch {
      siblings = [];
    }
  }

  return <PortalDetailClient asset={asset} siblings={siblings} />;
}
