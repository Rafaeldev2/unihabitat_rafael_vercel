import Link from "next/link";
import { Lock } from "lucide-react";
import { fetchAssetByPublicSlug, fetchPublicAssetsByActivoId } from "@/app/actions/assets";
import PortalDetailClient from "../../[id]/PortalDetailClient";

export default async function PortalInmuebleSlugPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const asset = await fetchAssetByPublicSlug(decodeURIComponent(slug));

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
