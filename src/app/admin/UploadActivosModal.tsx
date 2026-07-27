"use client";

import { useCallback, useRef, useState } from "react";
import { useApp } from "@/lib/context";
import { parseTemplateExcel, type ParseTemplateResult } from "@/lib/normalize-excel";
import { upsertAssets, upsertPropiedades } from "@/app/actions/assets";
import {
  X, Upload, Loader2, CheckCircle, AlertCircle,
  ChevronDown, ChevronUp, Copy, Download, FileSpreadsheet, Database,
} from "lucide-react";

interface UploadActivosModalProps {
  open: boolean;
  onClose: () => void;
}

type StepStatus = "pending" | "active" | "done" | "error";
interface Step { id: string; label: string; status: StepStatus; detail?: string; elapsed?: number; }

const INITIAL_STEPS: Step[] = [
  { id: "parse", label: "Leer Excel", status: "pending" },
  { id: "save",  label: "Guardar en base de datos", status: "pending" },
];

interface FailedUpsert { id: string; reason: string; }
interface LogEntry { ts: string; level: "info" | "warn" | "error"; msg: string; }

function fmtMs(ms?: number): string {
  if (ms == null) return "";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function UploadActivosModal({ open, onClose }: UploadActivosModalProps) {
  const { refreshAssets } = useApp();
  const fileRef = useRef<HTMLInputElement>(null);

  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [steps, setSteps] = useState<Step[]>(INITIAL_STEPS);
  const [diag, setDiag] = useState<ParseTemplateResult["diag"] | null>(null);
  const [failedInmuebles, setFailedInmuebles] = useState<FailedUpsert[]>([]);
  const [failedPropiedades, setFailedPropiedades] = useState<FailedUpsert[]>([]);
  const [failedOpen, setFailedOpen] = useState(false);

  const logsRef = useRef<LogEntry[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const pushLog = useCallback((level: LogEntry["level"], msg: string) => {
    const entry: LogEntry = { ts: new Date().toISOString(), level, msg };
    logsRef.current.push(entry);
    setLogs([...logsRef.current]);
    if (level === "error") console.error(`[upload] ${msg}`);
    else if (level === "warn") console.warn(`[upload] ${msg}`);
    else console.log(`[upload] ${msg}`);
  }, []);

  const updateStep = useCallback((id: string, patch: Partial<Step>) => {
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }, []);

  const reset = useCallback(() => {
    setStatus("idle");
    setMessage("");
    setSteps(INITIAL_STEPS);
    setDiag(null);
    setFailedInmuebles([]);
    setFailedPropiedades([]);
    setFailedOpen(false);
    setLogs([]);
    logsRef.current = [];
  }, []);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!/\.xlsx?$/i.test(file.name)) {
      setStatus("error");
      setMessage("Solo se permiten archivos Excel (.xlsx o .xls).");
      return;
    }

    reset();
    setStatus("loading");
    pushLog("info", `Inicio: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`);

    try {
      // ── Step 1: parse ───────────────────────────────────────────────────
      const t0 = Date.now();
      updateStep("parse", { status: "active", detail: `Leyendo ${file.name}…` });
      const result = await parseTemplateExcel(file);
      setDiag(result.diag);
      pushLog(
        "info",
        `Parser: ${result.inmuebles.length} inmueble(s) · ${result.propiedades.length} propiedad(es) — ${result.diag.parsed}/${result.diag.rows} filas (${Object.entries(result.diag.categoryCounts).map(([k, n]) => `${k}: ${n}`).join(", ") || "sin categoría"})`,
      );
      if (result.diag.skipped > 0) {
        const reasons = Object.entries(result.diag.skippedReasons)
          .map(([r, n]) => `${n} ${r}`).join(", ");
        pushLog("warn", `${result.diag.skipped} fila(s) descartadas: ${reasons}`);
      }
      updateStep("parse", {
        status: "done",
        elapsed: Date.now() - t0,
        detail: `${result.inmuebles.length} inmueble(s), ${result.propiedades.length} propiedad(es)`,
      });

      if (result.inmuebles.length === 0) {
        setStatus("error");
        setMessage("No se extrajeron inmuebles del archivo. Verifica las cabeceras (Referencia, ID1, Categoria) y los datos.");
        return;
      }

      // ── Step 2: guardar ─────────────────────────────────────────────────
      const t1 = Date.now();
      updateStep("save", { status: "active", detail: "Guardando inmuebles…" });

      const inmResult = await upsertAssets(result.inmuebles);
      pushLog(
        "info",
        `Inmuebles: ${inmResult.inserted} nuevo(s), ${inmResult.updated} actualizado(s)${inmResult.errors.length > 0 ? `, ${inmResult.errors.length} error(es)` : ""}`,
      );
      if (inmResult.errors.length > 0) {
        for (const err of inmResult.errors) pushLog("error", `Inmuebles: ${err}`);
        setFailedInmuebles(
          // Si no sabemos qué fila falló, marcamos todas las del batch al menos como dato.
          inmResult.errors.map((reason, i) => ({ id: `batch-${i}`, reason })),
        );
      }
      if (Object.keys(inmResult.duplicatesMerged).length > 0) {
        const sample = Object.keys(inmResult.duplicatesMerged).slice(0, 5);
        pushLog(
          "warn",
          `Inmuebles duplicados en el Excel (mismo id) fusionados: ${Object.keys(inmResult.duplicatesMerged).length}. Ej: ${sample.join(", ")}`,
        );
      }

      updateStep("save", { status: "active", detail: "Guardando propiedades…" });
      const propResult = await upsertPropiedades(result.propiedades);
      pushLog(
        "info",
        `Propiedades: ${propResult.inserted} nuevo(s), ${propResult.updated} actualizado(s)${propResult.errors.length > 0 ? `, ${propResult.errors.length} error(es)` : ""}`,
      );
      if (propResult.errors.length > 0) {
        for (const err of propResult.errors) pushLog("error", `Propiedades: ${err}`);
        setFailedPropiedades(
          propResult.errors.map((reason, i) => ({ id: `batch-${i}`, reason })),
        );
      }
      if (Object.keys(propResult.duplicatesMerged).length > 0) {
        const sample = Object.keys(propResult.duplicatesMerged).slice(0, 5);
        pushLog(
          "warn",
          `Propiedades con id duplicado fusionadas: ${Object.keys(propResult.duplicatesMerged).length}. Ej: ${sample.join(", ")}`,
        );
      }

      updateStep("save", {
        status: inmResult.errors.length + propResult.errors.length === 0 ? "done" : "error",
        elapsed: Date.now() - t1,
        detail: `${inmResult.inserted + inmResult.updated} inmueble(s) + ${propResult.inserted + propResult.updated} propiedad(es)`,
      });

      await refreshAssets();
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("propcrm-assets-updated"));
      }

      const hasErrors = inmResult.errors.length + propResult.errors.length > 0;
      if (hasErrors) {
        setStatus("error");
        setMessage(`Se subieron datos pero hubo errores parciales. Revisa el log.`);
      } else {
        setStatus("success");
        setMessage(`✓ Importación completa: ${result.inmuebles.length} inmueble(s) y ${result.propiedades.length} propiedad(es).`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      pushLog("error", `Excepción: ${msg}`);
      setStatus("error");
      setMessage(`Error: ${msg}`);
      // Marca el paso activo como error.
      setSteps((prev) => prev.map((s) => (s.status === "active" ? { ...s, status: "error" } : s)));
    }
  };

  const downloadLog = useCallback(() => {
    const lines = logsRef.current.map((l) => `[${l.ts}] ${l.level.toUpperCase()} ${l.msg}`);
    const blob = new Blob([lines.join("\n") + "\n"], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `propcrm-upload-${new Date().toISOString().replace(/[:.]/g, "-")}.log`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const copyFailedIds = useCallback((failed: FailedUpsert[]) => {
    const text = failed.map((f) => `${f.id}\t${f.reason}`).join("\n");
    void navigator.clipboard?.writeText(text);
  }, []);

  if (!open) return null;

  const totalFailed = failedInmuebles.length + failedPropiedades.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="text-blue-600" size={20} />
            <h2 className="text-lg font-semibold">Importar Excel (CDR / NPL)</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-gray-100">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4 p-6">
          {/* File input */}
          {status === "idle" && (
            <div className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-gray-300 p-8 text-center">
              <Upload size={32} className="text-gray-400" />
              <div>
                <p className="text-sm font-medium">Selecciona la plantilla maestra</p>
                <p className="text-xs text-gray-500">Formato esperado: plantilla CDR o NPL con cabecera estándar</p>
              </div>
              <button
                onClick={() => fileRef.current?.click()}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Elegir archivo
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFile}
                className="hidden"
              />
            </div>
          )}

          {/* Steps */}
          {status !== "idle" && (
            <div className="space-y-2">
              {steps.map((step) => (
                <div key={step.id} className="flex items-start gap-3 rounded-lg border p-3">
                  <div className="mt-0.5">
                    {step.status === "done" && <CheckCircle size={18} className="text-green-600" />}
                    {step.status === "error" && <AlertCircle size={18} className="text-red-600" />}
                    {step.status === "active" && <Loader2 size={18} className="animate-spin text-blue-600" />}
                    {step.status === "pending" && <Database size={18} className="text-gray-300" />}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">{step.label}</p>
                      {step.elapsed != null && (
                        <span className="text-xs text-gray-500">{fmtMs(step.elapsed)}</span>
                      )}
                    </div>
                    {step.detail && <p className="text-xs text-gray-600">{step.detail}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Diagnostic summary */}
          {diag && (
            <div className="rounded-lg bg-gray-50 p-3 text-xs text-gray-700">
              <p>
                Hoja: <strong>{diag.sheet}</strong> · Filas: {diag.rows} · Parseadas: {diag.parsed} · Descartadas: {diag.skipped}
              </p>
              <p>
                Categorías:{" "}
                {Object.entries(diag.categoryCounts).map(([k, n]) => `${k}=${n}`).join(", ") || "—"}
              </p>
              <p className="mt-1 text-gray-500">
                Filas con el mismo ID compuesto (ID1 + Referencia) se fusionan; ID1 repetido con
                Referencia distinta crea inmuebles distintos del mismo grupo.
              </p>
            </div>
          )}

          {/* Message banner */}
          {message && (
            <div
              className={`rounded-lg p-3 text-sm ${
                status === "success"
                  ? "bg-green-50 text-green-800"
                  : status === "error"
                  ? "bg-red-50 text-red-800"
                  : "bg-blue-50 text-blue-800"
              }`}
            >
              {message}
            </div>
          )}

          {/* Failed batches */}
          {totalFailed > 0 && (
            <div className="rounded-lg border border-red-300 bg-red-50">
              <button
                onClick={() => setFailedOpen((v) => !v)}
                className="flex w-full items-center justify-between p-3 text-left"
              >
                <span className="text-sm font-medium text-red-800">
                  {totalFailed} batch(es) con errores
                </span>
                {failedOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </button>
              {failedOpen && (
                <div className="space-y-2 border-t border-red-200 p-3 text-xs">
                  {failedInmuebles.length > 0 && (
                    <div>
                      <div className="mb-1 flex items-center justify-between font-semibold text-red-800">
                        <span>Inmuebles ({failedInmuebles.length})</span>
                        <button
                          onClick={() => copyFailedIds(failedInmuebles)}
                          className="flex items-center gap-1 rounded bg-red-100 px-2 py-0.5 hover:bg-red-200"
                        >
                          <Copy size={12} /> Copiar
                        </button>
                      </div>
                      <ul className="space-y-0.5 text-red-700">
                        {failedInmuebles.slice(0, 20).map((f, i) => (
                          <li key={i} className="truncate"><strong>{f.id}</strong> — {f.reason}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {failedPropiedades.length > 0 && (
                    <div>
                      <div className="mb-1 flex items-center justify-between font-semibold text-red-800">
                        <span>Propiedades ({failedPropiedades.length})</span>
                        <button
                          onClick={() => copyFailedIds(failedPropiedades)}
                          className="flex items-center gap-1 rounded bg-red-100 px-2 py-0.5 hover:bg-red-200"
                        >
                          <Copy size={12} /> Copiar
                        </button>
                      </div>
                      <ul className="space-y-0.5 text-red-700">
                        {failedPropiedades.slice(0, 20).map((f, i) => (
                          <li key={i} className="truncate"><strong>{f.id}</strong> — {f.reason}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Log */}
          {logs.length > 0 && (
            <details className="rounded-lg border border-gray-200 bg-gray-50 text-xs">
              <summary className="cursor-pointer p-3 font-medium">
                Log de la importación ({logs.length} líneas)
              </summary>
              <div className="max-h-60 overflow-auto border-t border-gray-200 p-3 font-mono">
                {logs.map((l, i) => (
                  <div
                    key={i}
                    className={
                      l.level === "error"
                        ? "text-red-700"
                        : l.level === "warn"
                        ? "text-amber-700"
                        : "text-gray-700"
                    }
                  >
                    {l.msg}
                  </div>
                ))}
              </div>
              <div className="border-t border-gray-200 p-2">
                <button
                  onClick={downloadLog}
                  className="flex items-center gap-1 rounded bg-gray-200 px-2 py-1 text-xs hover:bg-gray-300"
                >
                  <Download size={12} /> Descargar log
                </button>
              </div>
            </details>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t bg-gray-50 px-6 py-3">
          {(status === "success" || status === "error") && (
            <button
              onClick={reset}
              className="rounded-lg bg-white px-4 py-2 text-sm font-medium ring-1 ring-gray-300 hover:bg-gray-50"
            >
              Importar otro
            </button>
          )}
          <button
            onClick={onClose}
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
