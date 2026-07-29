import { redirect } from "next/navigation";
import Link from "next/link";
import { Lock } from "lucide-react";
import { fetchAssetById } from "@/app/actions/assets";
import { privateAssetPath } from "@/lib/public-slug";

/**
 * Ruta legacy `/portal/privado/{id}` → redirige a `/portal/privado/inmueble/{slug}`.
 */
export default async function PortalPrivadoDetailLegacyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: raw } = await params;
  const id = decodeURIComponent(raw);
  const asset = await fetchAssetById(id);

  if (!asset) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center px-6 py-16 text-center">
        <Lock size={40} strokeWidth={1} className="text-border" />
        <p className="mt-3 text-sm text-muted">Activo no encontrado</p>
        <Link href="/portal/privado" className="mt-3 text-sm text-gold hover:underline">
          Volver a mi zona
        </Link>
      </div>
    );
  }

  if (asset.publicSlug) {
    redirect(privateAssetPath(asset.publicSlug));
  }

  // Sin slug aún (migración pendiente): redirigir al listado privado.
  redirect("/portal/privado");
}
