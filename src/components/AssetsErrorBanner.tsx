"use client";

import { useApp } from "@/lib/context";
import { AlertCircle, RefreshCw, Loader2 } from "lucide-react";
import { useState } from "react";

/**
 * Banner rojo en la parte superior del panel admin cuando `fetchAssets`
 * falla. Antes los errores quedaban silenciados en consola y la lista volvía
 * vacía, lo que confundía con "BD vacía" o con el flash de los mocks. Ahora
 * el usuario ve el motivo y puede reintentar sin recargar la página.
 */
export function AssetsErrorBanner() {
  const { assetsError, refreshAssets } = useApp();
  const [retrying, setRetrying] = useState(false);

  if (!assetsError) return null;

  const onRetry = async () => {
    setRetrying(true);
    try {
      await refreshAssets();
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div className="border-b border-red/30 bg-red/5 px-6 py-2.5 text-xs text-red">
      <div className="mx-auto flex max-w-7xl items-center gap-3">
        <AlertCircle size={14} className="shrink-0" />
        <span className="flex-1">
          <span className="font-semibold">No se pudieron cargar los activos:</span> {assetsError}
        </span>
        <button
          type="button"
          onClick={onRetry}
          disabled={retrying}
          className="flex items-center gap-1 rounded-md border border-red/40 bg-white px-2.5 py-1 text-[11px] font-medium text-red transition-colors hover:bg-red/5 disabled:opacity-60"
        >
          {retrying ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
          Reintentar
        </button>
      </div>
    </div>
  );
}
