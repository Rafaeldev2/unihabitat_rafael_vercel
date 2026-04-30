"use client";

import { useState, useTransition } from "react";
import { Loader2, MapPin, CheckCircle, AlertCircle, RefreshCw, Activity } from "lucide-react";
import { pingGeoapify, fetchRecentGeoEvents, type GeoapifyPingResult } from "@/app/actions/diagnostics";
import type { GeoEvent } from "@/lib/catastro/geoapify-logger";

/**
 * Panel de diagnóstico Geoapify. Pensado para `/admin/config`.
 *
 *  - "Probar Geoapify" llama una vez al endpoint de geocoding con texto fijo
 *    ("Madrid, España"). Muestra: keySource, longitud de clave, status HTTP,
 *    snippet del cuerpo (si error), y coords resultantes.
 *  - "Cargar últimos eventos" trae los últimos N eventos del logger interno
 *    para mostrar las llamadas reales recientes (con sus categorías de error).
 *
 * No persiste nada; es solo lectura.
 */
export function GeoapifyDiagnostics() {
  const [pingResult, setPingResult] = useState<GeoapifyPingResult | null>(null);
  const [pinging, startPing] = useTransition();
  const [events, setEvents] = useState<GeoEvent[] | null>(null);
  const [loadingEvents, startLoadingEvents] = useTransition();

  const runPing = () => {
    startPing(async () => {
      try {
        const r = await pingGeoapify();
        setPingResult(r);
      } catch (err) {
        setPingResult({
          keyPresent: false,
          keySource: "none",
          keyLength: 0,
          httpStatus: 0,
          ok: false,
          coords: null,
          bodySnippet: "",
          errorMessage: err instanceof Error ? err.message : String(err),
          durationMs: 0,
        });
      }
    });
  };

  const loadEvents = () => {
    startLoadingEvents(async () => {
      try {
        const e = await fetchRecentGeoEvents(50);
        setEvents(e);
      } catch (err) {
        setEvents([]);
        console.error("[GeoapifyDiagnostics] fetchRecentGeoEvents falló:", err);
      }
    });
  };

  return (
    <section className="rounded-lg border border-border bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin size={16} className="text-gold" />
          <h3 className="text-sm font-semibold text-navy">Diagnóstico Geoapify</h3>
        </div>
      </div>
      <p className="mb-4 text-xs text-muted">
        Verifica que la clave configurada en <code>.env.local</code> está activa y
        funciona. Si acabas de cambiarla, reinicia <code>npm run dev</code> antes
        de probar — el servidor lee el entorno una sola vez al arrancar.
      </p>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={runPing}
          disabled={pinging}
          className="flex items-center gap-1.5 rounded-md border border-border bg-white px-3 py-1.5 text-xs font-medium text-navy transition-colors hover:bg-cream disabled:opacity-60"
        >
          {pinging ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
          Probar Geoapify
        </button>
        <button
          type="button"
          onClick={loadEvents}
          disabled={loadingEvents}
          className="flex items-center gap-1.5 rounded-md border border-border bg-white px-3 py-1.5 text-xs font-medium text-navy transition-colors hover:bg-cream disabled:opacity-60"
        >
          {loadingEvents ? <Loader2 size={12} className="animate-spin" /> : <Activity size={12} />}
          Últimos eventos ({events?.length ?? 0})
        </button>
      </div>

      {pingResult && (
        <div className="mt-4 rounded-md border border-border bg-cream2 p-3">
          <div className="mb-2 flex items-center gap-2 text-xs">
            {pingResult.ok ? (
              <span className="flex items-center gap-1 font-semibold text-green">
                <CheckCircle size={13} /> OK · {pingResult.durationMs}ms
              </span>
            ) : (
              <span className="flex items-center gap-1 font-semibold text-red">
                <AlertCircle size={13} /> FALLO · {pingResult.durationMs}ms
              </span>
            )}
          </div>
          <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-[11px]">
            <dt className="font-semibold text-navy">Clave presente</dt>
            <dd className="text-text">{pingResult.keyPresent ? "sí" : "no"}</dd>
            <dt className="font-semibold text-navy">Origen</dt>
            <dd className="font-mono text-text">{pingResult.keySource}</dd>
            <dt className="font-semibold text-navy">Longitud clave</dt>
            <dd className="text-text">{pingResult.keyLength}</dd>
            <dt className="font-semibold text-navy">HTTP status</dt>
            <dd className="text-text">{pingResult.httpStatus || "—"}</dd>
            {pingResult.coords && (
              <>
                <dt className="font-semibold text-navy">Coords</dt>
                <dd className="font-mono text-text">{pingResult.coords.lat}, {pingResult.coords.lon}</dd>
              </>
            )}
            {pingResult.errorMessage && (
              <>
                <dt className="font-semibold text-red">Error</dt>
                <dd className="text-red">{pingResult.errorMessage}</dd>
              </>
            )}
            {pingResult.bodySnippet && (
              <>
                <dt className="font-semibold text-navy">Body</dt>
                <dd className="break-all font-mono text-[10px] text-muted">{pingResult.bodySnippet}</dd>
              </>
            )}
          </dl>
        </div>
      )}

      {events && events.length > 0 && (
        <div className="mt-4 max-h-64 overflow-auto rounded-md border border-border bg-cream2">
          <table className="w-full text-[10px]">
            <thead className="sticky top-0 bg-cream text-muted">
              <tr>
                <th className="px-2 py-1 text-left font-semibold">Hora</th>
                <th className="px-2 py-1 text-left font-semibold">Op</th>
                <th className="px-2 py-1 text-left font-semibold">Reason</th>
                <th className="px-2 py-1 text-left font-semibold">ms</th>
                <th className="px-2 py-1 text-left font-semibold">id / detalle</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              {events.slice().reverse().map((e, i) => (
                <tr key={i} className={`border-t border-border/50 ${e.ok ? "" : "bg-red/5"}`}>
                  <td className="px-2 py-1 text-muted">{e.ts.slice(11, 19)}</td>
                  <td className="px-2 py-1">{e.op}</td>
                  <td className={`px-2 py-1 ${e.ok ? "text-green" : "text-red"}`}>{e.reason}</td>
                  <td className="px-2 py-1 text-muted">{e.durationMs ?? "—"}</td>
                  <td className="px-2 py-1 text-text">
                    {e.assetId ?? ""}{e.assetId && (e.message || e.bodySnippet || e.textSnippet) ? " · " : ""}
                    {e.message || e.bodySnippet || e.textSnippet || ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {events && events.length === 0 && (
        <p className="mt-3 text-[11px] text-muted">
          No hay eventos en el anillo del logger. Ejecuta una importación o pulsa "Probar Geoapify" para generar tráfico.
        </p>
      )}
    </section>
  );
}
