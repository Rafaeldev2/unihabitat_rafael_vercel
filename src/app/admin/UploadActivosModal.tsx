"use client";

import { useState, useRef, useCallback } from "react";
import { useApp } from "@/lib/context";
import { parseExcelFile, extractRawPreview, parseWithMapping, type ParseExcelResult } from "@/lib/normalize-excel";
import { enrichAssetsBatch } from "@/app/actions/catastro";
import type { CatastroEnrichFailure } from "@/app/actions/catastro";
import { validateAssetsBatch } from "@/app/actions/claude";
import type { ClaudeAssetResult } from "@/app/actions/claude";
import { upsertAssets } from "@/app/actions/assets";
import { detectFormatWithClaude } from "@/app/actions/claude-format-detect";
import type { Asset } from "@/lib/types";
import { computeEmptyStatsFromAssets, formatExcelImportEmptySummary } from "@/lib/excel-raw-utils";
import {
  X, Upload, Loader2, CheckCircle, AlertCircle,
  ChevronDown, ChevronUp, Sparkles, FileSpreadsheet,
  Brain, MapPin, Database, Clock, Ban, Zap,
} from "lucide-react";

// ─── Tunables ────────────────────────────────────────────────────────────────
const AI_BATCH_SIZE = 50;          // activos por llamada Claude (era 20)
const AI_CONCURRENCY = 3;          // llamadas Claude en paralelo
const AI_SKIP_THRESHOLD = 500;     // omitir IA para archivos > N activos
const CATASTRO_BATCH_SIZE = 30;    // activos por llamada Catastro (era 15)
const CATASTRO_CONCURRENCY = 6;    // llamadas Catastro en paralelo
const DB_BATCH_SIZE = 100;         // activos por upsert a Supabase (era 50)
const DB_CONCURRENCY = 4;          // upserts paralelos
// ─────────────────────────────────────────────────────────────────────────────

function chunkArray<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/** Ejecuta `worker` sobre `items` con máximo `concurrency` promesas activas a la vez. */
async function runConcurrent<T, R>(
  items: T[],
  worker: (item: T, idx: number) => Promise<R>,
  concurrency: number,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  async function pump() {
    while (next < items.length) {
      const i = next++;
      results[i] = await worker(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, pump));
  return results;
}

function applyClaudeCorrections(assets: Asset[], results: ClaudeAssetResult[]): Asset[] {
  const map = new Map<string, ClaudeAssetResult>();
  for (const r of results) map.set(r.id, r);
  return assets.map((a) => {
    const c = map.get(a.id);
    if (!c) return a;
    return {
      ...a,
      tip: c.tip ?? a.tip,
      tipC: c.tipC ?? a.tipC,
      fase: c.fase ?? a.fase,
      faseC: c.faseC ?? a.faseC,
      prov: c.prov ?? a.prov,
      cp: c.cp ?? a.cp,
    };
  });
}

interface UploadActivosModalProps {
  open: boolean;
  onClose: () => void;
}

type StepId = "parse" | "db-raw" | "ai-detect" | "ai-validate" | "catastro";
type StepStatus = "pending" | "active" | "done" | "error" | "skipped";

interface PipelineStep {
  id: StepId;
  label: string;
  detail: string;
  status: StepStatus;
  elapsed?: number;
}

const INITIAL_STEPS: PipelineStep[] = [
  { id: "parse",       label: "Lectura Excel",   detail: "Leyendo hojas y normalizando columnas…",     status: "pending" },
  { id: "db-raw",      label: "Guardado rápido",  detail: "Subiendo activos sin enriquecer…",           status: "pending" },
  { id: "ai-detect",   label: "Detección IA",     detail: "Identificando formato con Claude…",          status: "pending" },
  { id: "ai-validate", label: "Validación IA",    detail: "Clasificando y validando activos…",          status: "pending" },
  { id: "catastro",    label: "Catastro",          detail: "Enriqueciendo con datos del Catastro…",     status: "pending" },
];

const STEP_ICONS: Record<StepId, React.ReactNode> = {
  "parse":       <FileSpreadsheet size={15} />,
  "db-raw":      <Zap size={15} />,
  "ai-detect":   <Brain size={15} />,
  "ai-validate": <Sparkles size={15} />,
  "catastro":    <MapPin size={15} />,
};

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const min = Math.floor(ms / 60_000);
  const sec = Math.round((ms % 60_000) / 1000);
  return `${min}m ${sec}s`;
}

function formatEta(seconds: number): string {
  if (seconds < 60) return `~${seconds}s`;
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  return `~${min}m ${sec}s`;
}

function SubProgress({ done, total, label }: { done: number; total: number; label: string }) {
  if (total <= 0) return null;
  const pct = Math.round((done / total) * 100);
  return (
    <div className="space-y-1.5 rounded-lg bg-blue-50/70 px-3 py-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium text-blue-700">
          {done} de {total} {label}
        </span>
        <span className="text-[11px] font-semibold text-blue-500">{pct}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-blue-100">
        <div
          className="h-full rounded-full bg-blue-500 transition-all duration-300 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function UploadActivosModal({ open, onClose }: UploadActivosModalProps) {
  const { addAssets, assets: existing } = useApp();
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [steps, setSteps] = useState<PipelineStep[]>(INITIAL_STEPS);
  const [parsedCount, setParsedCount] = useState(0);
  const [aiSummary, setAiSummary] = useState("");
  const [aiWarnings, setAiWarnings] = useState<ClaudeAssetResult[]>([]);
  const [warningsOpen, setWarningsOpen] = useState(false);
  const [subProgress, setSubProgress] = useState({ done: 0, total: 0, label: "" });
  const [excelEmptySummary, setExcelEmptySummary] = useState<string | null>(null);
  const cancelledRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const updateStep = useCallback((id: StepId, patch: Partial<PipelineStep>) => {
    setSteps(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s));
  }, []);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.name.endsWith(".xlsx") && !file.name.endsWith(".xls")) {
      setStatus("error");
      setMessage("Solo se permiten archivos Excel (.xlsx o .xls).");
      return;
    }

    setStatus("loading");
    setMessage("");
    setAiSummary("");
    setAiWarnings([]);
    setParsedCount(0);
    setExcelEmptySummary(null);
    setSubProgress({ done: 0, total: 0, label: "" });
    cancelledRef.current = false;
    setSteps(INITIAL_STEPS.map(s => ({ ...s, status: "pending", elapsed: undefined })));

    try {
      // ── Step 1: Parse Excel ──────────────────────────────────────────────
      const t0 = Date.now();
      updateStep("parse", { status: "active", detail: `Leyendo ${file.name}…` });
      const diagResult = await parseExcelFile(file, { diag: true }) as ParseExcelResult;
      let parsed = diagResult.assets;
      const sheetInfo = diagResult.sheetDiag
        .filter(s => s.format !== "unknown")
        .map(s => `${s.sheet}: ${s.format} (${s.rows})`)
        .join(" · ");
      updateStep("parse", {
        status: "done",
        detail: parsed.length > 0
          ? `${parsed.length} activo(s) — ${sheetInfo || "formato detectado por cabecera"}`
          : "Sin formato reconocido",
        elapsed: Date.now() - t0,
      });

      // ── Step 1b: AI Format Detection (solo si parse devolvió 0) ─────────
      if (parsed.length === 0) {
        const t1 = Date.now();
        updateStep("ai-detect", { status: "active", detail: "Enviando cabeceras a Claude…" });
        try {
          const preview = await extractRawPreview(file);
          const detection = await detectFormatWithClaude(preview);

          if (detection.confidence > 0.5 && Object.keys(detection.mapping).length > 0) {
            updateStep("ai-detect", { status: "active", detail: `Formato detectado (${detection.description}). Parseando…` });
            parsed = await parseWithMapping(file, detection.mapping);
            if (parsed.length === 0) {
              updateStep("ai-detect", { status: "error", detail: "Formato detectado pero sin filas válidas", elapsed: Date.now() - t1 });
              setStatus("error");
              setMessage(`La IA identificó el formato (${detection.description}) pero no se pudieron extraer filas válidas.`);
              return;
            }
            updateStep("ai-detect", { status: "done", detail: `${parsed.length} activo(s) extraídos con IA`, elapsed: Date.now() - t1 });
          } else {
            updateStep("ai-detect", { status: "error", detail: "No se pudo detectar el formato", elapsed: Date.now() - t1 });
            setStatus("error");
            setMessage("No se encontraron filas válidas. La IA tampoco pudo detectar el formato del Excel.");
            return;
          }
        } catch {
          updateStep("ai-detect", { status: "error", detail: "Error de conexión con IA", elapsed: Date.now() - t1 });
          setStatus("error");
          setMessage("No se encontraron filas válidas. La detección automática con IA falló.");
          return;
        }
      } else {
        updateStep("ai-detect", { status: "skipped", detail: "Formato reconocido — no necesario" });
      }

      setParsedCount(parsed.length);
      setExcelEmptySummary(formatExcelImportEmptySummary(computeEmptyStatsFromAssets(parsed)));

      // ── Step 2: Guardar activos RAW inmediatamente ───────────────────────
      // El usuario ve los activos en el CRM en segundos, sin esperar enriquecimiento.
      const tRaw = Date.now();
      updateStep("db-raw", { status: "active", detail: `Guardando ${parsed.length} activos en Supabase…` });
      try {
        const rawBatches = chunkArray(parsed, DB_BATCH_SIZE);
        let rawSaved = 0;
        const dbErrors: string[] = [];
        await runConcurrent(rawBatches, async (batch) => {
          const result = await upsertAssets(batch);
          if (result.errors.length > 0) {
            dbErrors.push(...result.errors);
          }
          rawSaved += result.inserted + result.updated;
          updateStep("db-raw", { status: "active", detail: `${rawSaved}/${parsed.length} activos guardados…` });
        }, DB_CONCURRENCY);

        addAssets(parsed);

        if (dbErrors.length > 0) {
          updateStep("db-raw", {
            status: "error",
            detail: `${rawSaved}/${parsed.length} guardados — Errores: ${dbErrors.slice(0, 3).join("; ")}`,
            elapsed: Date.now() - tRaw,
          });
        } else {
          updateStep("db-raw", {
            status: "done",
            detail: `${parsed.length} activos disponibles en el CRM`,
            elapsed: Date.now() - tRaw,
          });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "error desconocido";
        updateStep("db-raw", { status: "error", detail: msg, elapsed: Date.now() - tRaw });
      }

      if (cancelledRef.current) { setStatus("success"); setMessage("Cancelado por el usuario."); return; }

      // ── Step 3: AI Validation (paralelo, omitir para archivos grandes) ───
      const skipAI = parsed.length > AI_SKIP_THRESHOLD;
      const allClaudeResults: ClaudeAssetResult[] = [];

      if (skipAI) {
        updateStep("ai-validate", {
          status: "skipped",
          detail: `Omitido — ${parsed.length} activos supera el límite (${AI_SKIP_THRESHOLD}). Actívalo manualmente si necesitas validación IA.`,
        });
      } else {
        const tAI = Date.now();
        const aiBatches = chunkArray(parsed, AI_BATCH_SIZE);
        let aiDone = 0;
        let aiErrors = 0;
        const summaries: string[] = [];

        setSubProgress({ done: 0, total: aiBatches.length, label: "lotes IA" });
        updateStep("ai-validate", {
          status: "active",
          detail: `Validando ${aiBatches.length} lotes en paralelo (${AI_CONCURRENCY} concurrent)…`,
        });

        await runConcurrent(aiBatches, async (batch) => {
          if (cancelledRef.current) return;
          try {
            const { results, summary, error } = await validateAssetsBatch(batch);
            if (error) { summaries.push(error); aiErrors++; }
            else { allClaudeResults.push(...results); if (summary) summaries.push(summary); }
          } catch (err) {
            summaries.push(err instanceof Error ? err.message : String(err));
            aiErrors++;
          }
          aiDone++;
          const elapsed = Date.now() - tAI;
          const avgMs = elapsed / aiDone;
          const remaining = Math.round(avgMs * (aiBatches.length - aiDone) / 1000);
          setSubProgress({ done: aiDone, total: aiBatches.length, label: "lotes IA" });
          updateStep("ai-validate", {
            status: "active",
            detail: `${aiDone}/${aiBatches.length} lotes${remaining > 0 ? ` — ${formatEta(remaining)}` : ""}`,
            elapsed,
          });
        }, AI_CONCURRENCY);

        if (!cancelledRef.current) {
          parsed = applyClaudeCorrections(parsed, allClaudeResults);
          const withWarnings = allClaudeResults.filter(a => a.warnings.length > 0);
          if (withWarnings.length > 0) setAiWarnings(withWarnings);
          const corrected = allClaudeResults.filter(a => a.tip || a.tipC || a.fase || a.faseC || a.prov || a.cp).length;
          const parts: string[] = [`${parsed.length} activos validados`];
          if (corrected > 0) parts.push(`${corrected} corregidos`);
          if (withWarnings.length > 0) parts.push(`${withWarnings.length} con advertencias`);
          if (aiErrors > 0) parts.push(`${aiErrors} lotes con error`);
          setAiSummary(parts.join(" · "));
          updateStep("ai-validate", {
            status: "done",
            detail: parts.join(", "),
            elapsed: Date.now() - tAI,
          });
        }
      }

      if (cancelledRef.current) { setStatus("success"); setMessage("Cancelado por el usuario."); return; }

      // ── Step 4: Catastro en paralelo con guardado por lote ───────────────
      const existingIds = new Set(existing.map(a => a.id));
      const toEnrich = parsed.filter(a => !existingIds.has(a.id));
      const toUpdate = parsed.filter(a => existingIds.has(a.id));

      const parts: string[] = [];

      if (toUpdate.length > 0) parts.push(`${toUpdate.length} existente(s) actualizado(s).`);

      if (toEnrich.length === 0 || cancelledRef.current) {
        updateStep("catastro", { status: "skipped", detail: cancelledRef.current ? "Cancelado" : "Todos los activos ya existen" });
      } else {
        const tCat = Date.now();
        const catBatches = chunkArray(toEnrich, CATASTRO_BATCH_SIZE);
        let catDone = 0;
        let catOk = 0, catSkipped = 0;
        const catFailed: CatastroEnrichFailure[] = [];
        // Mantener resultados en orden de índice de batch
        const enrichedByBatch: Asset[][] = new Array(catBatches.length);

        setSubProgress({ done: 0, total: catBatches.length, label: "lotes Catastro" });
        updateStep("catastro", {
          status: "active",
          detail: `0/${catBatches.length} lotes (${CATASTRO_CONCURRENCY} paralelos)…`,
        });

        await runConcurrent(catBatches, async (batch, batchIdx) => {
          if (cancelledRef.current) { enrichedByBatch[batchIdx] = batch; return; }

          const result = await enrichAssetsBatch(batch);
          enrichedByBatch[batchIdx] = result.assets;
          catOk += result.ok;
          catSkipped += result.skipped;
          catFailed.push(...result.failed);
          catDone++;

          // Solo actualizar contexto React (sin llamada a BD por lote — se guarda al final)
          addAssets(result.assets);

          const elapsed = Date.now() - tCat;
          const avgMs = elapsed / catDone;
          const remaining = Math.round(avgMs * (catBatches.length - catDone) / 1000);
          setSubProgress({ done: catDone, total: catBatches.length, label: "lotes Catastro" });
          updateStep("catastro", {
            status: "active",
            detail: `${catDone}/${catBatches.length} lotes — ${catOk} enriquecidos${remaining > 0 ? ` — ${formatEta(remaining)}` : ""}`,
            elapsed,
          });
        }, CATASTRO_CONCURRENCY);

        const allEnriched = enrichedByBatch.flat();
        parts.push(`${toEnrich.length} nuevo(s): ${catOk} enriquecido(s) con Catastro.`);
        if (catSkipped > 0) parts.push(`${catSkipped} sin ref. catastral.`);
        if (catFailed.length > 0) parts.push(`${catFailed.length} error(es).`);

        updateStep("catastro", {
          status: cancelledRef.current ? "error" : "done",
          detail: cancelledRef.current
            ? `Cancelado — ${catDone}/${catBatches.length} lotes procesados`
            : `${catOk} enriquecido(s), ${catSkipped} omitido(s), ${catFailed.length} error(es)`,
          elapsed: Date.now() - tCat,
        });

        // Guardar activos enriquecidos en BD — UN único upsert al final (no por lote)
        if (!cancelledRef.current && allEnriched.length > 0) {
          const toSave = !skipAI && allClaudeResults.length > 0
            ? allEnriched.map(a => {
                const c = allClaudeResults.find(r => r.id === a.id);
                if (!c) return a;
                return { ...a, tip: c.tip ?? a.tip, tipC: c.tipC ?? a.tipC, fase: c.fase ?? a.fase, faseC: c.faseC ?? a.faseC };
              })
            : allEnriched;
          // Guardar en paralelo con batches grandes para minimizar invocaciones
          const dbBatches = chunkArray(toSave, DB_BATCH_SIZE);
          await runConcurrent(dbBatches, (batch) => upsertAssets(batch), DB_CONCURRENCY);
        }
      }

      setMessage(parts.length > 0 ? parts.join(" ") : `${parsed.length} activos procesados.`);
      if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("propcrm-assets-updated"));
      setStatus("success");
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Error al procesar el archivo.");
    }
  };

  const handleCancel = useCallback(() => { cancelledRef.current = true; }, []);

  const handleClose = () => {
    if (status === "loading") {
      const confirmed = window.confirm(
        "El proceso está en marcha.\n\nLos activos ya guardados se conservarán en el CRM.\n\n¿Cancelar el enriquecimiento pendiente?"
      );
      if (!confirmed) return;
      cancelledRef.current = true;
    }
    setStatus("idle");
    setMessage("");
    setAiSummary("");
    setAiWarnings([]);
    setWarningsOpen(false);
    setParsedCount(0);
    setExcelEmptySummary(null);
    setSubProgress({ done: 0, total: 0, label: "" });
    cancelledRef.current = false;
    setSteps(INITIAL_STEPS);
    onClose();
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      if (status === "loading") return;
      handleClose();
    }
  };

  if (!open) return null;

  const activeStep = steps.find(s => s.status === "active");
  const doneSteps = steps.filter(s => s.status === "done").length;
  const totalRelevant = steps.filter(s => s.status !== "pending").length || 1;
  const showCancelBtn = activeStep && (activeStep.id === "ai-validate" || activeStep.id === "catastro") && !cancelledRef.current;

  function StepList({ compact = false }: { compact?: boolean }) {
    return (
      <div className="space-y-1">
        {steps.map((step) => {
          if (step.status === "pending") return null;
          return (
            <div
              key={step.id}
              className={`flex items-start gap-2.5 rounded-lg px-3 ${compact ? "py-1.5" : "py-2"} transition-all duration-300 ${
                step.status === "active"   ? "bg-blue-50 ring-1 ring-blue-200"
                : step.status === "error"  ? "bg-red-50"
                : step.status === "skipped" ? "bg-gray-50 opacity-50"
                : "bg-green-50/60"
              }`}
            >
              <div className={`mt-0.5 shrink-0 ${
                step.status === "active"  ? "text-blue-500"
                : step.status === "done" ? "text-green-500"
                : step.status === "error" ? "text-red-400"
                : "text-gray-400"
              }`}>
                {step.status === "active"
                  ? <Loader2 size={compact ? 14 : 15} className="animate-spin" />
                  : step.status === "done"
                    ? <CheckCircle size={compact ? 14 : 15} />
                    : step.status === "error"
                      ? <AlertCircle size={compact ? 14 : 15} />
                      : STEP_ICONS[step.id]
                }
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className={`text-xs font-semibold ${
                    step.status === "active"  ? "text-blue-700"
                    : step.status === "done"  ? "text-green-700"
                    : step.status === "error" ? "text-red-600"
                    : "text-gray-500"
                  }`}>
                    {step.label}
                  </span>
                  {step.elapsed != null && (
                    <span className="flex items-center gap-0.5 text-[10px] text-gray-400">
                      <Clock size={compact ? 8 : 9} />
                      {formatMs(step.elapsed)}
                    </span>
                  )}
                </div>
                <p className={`text-[11px] leading-tight ${
                  step.status === "active"  ? "text-blue-600"
                  : step.status === "error" ? "text-red-500"
                  : "text-gray-500"
                }`}>
                  {step.detail}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
      onClick={handleOverlayClick}
    >
      <div
        className="w-full max-w-lg rounded-xl border border-border bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-lg font-semibold text-navy">Cargar activos desde Excel</h2>
          <button
            type="button"
            onClick={handleClose}
            className={`rounded-lg p-1.5 transition-colors ${
              status === "loading"
                ? "text-gray-300 hover:bg-red-50 hover:text-red-400"
                : "text-muted hover:bg-cream hover:text-navy"
            }`}
            title={status === "loading" ? "Cancelar proceso" : "Cerrar"}
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5">
          {status === "idle" && (
            <>
              <p className="mb-4 text-sm text-muted">
                Sube un Excel con hojas <strong>Proveedor 1</strong>, <strong>Proveedor 2</strong>,{" "}
                <strong>Proveedor 3</strong> y opcionalmente <strong>Enriquecido</strong>. Si el formato
                no se reconoce, la IA intentará detectarlo automáticamente.
              </p>
              <div className="mb-3 flex items-start gap-2 rounded-lg bg-blue-50 px-3 py-2">
                <Zap size={14} className="mt-0.5 shrink-0 text-blue-500" />
                <p className="text-[11px] text-blue-700">
                  Los activos se guardan en el CRM <strong>inmediatamente</strong> tras la lectura.
                  El enriquecimiento con Catastro se procesa en paralelo.
                  {AI_SKIP_THRESHOLD > 0 && (
                    <> Archivos de más de {AI_SKIP_THRESHOLD} activos omiten la validación IA para mayor velocidad.</>
                  )}
                </p>
              </div>
              <input ref={inputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFile} />
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-cream/50 py-8 transition-colors hover:border-navy/30 hover:bg-cream"
              >
                <Upload size={24} className="text-muted" />
                <span className="text-sm font-medium text-navy">Seleccionar archivo .xlsx</span>
              </button>
            </>
          )}

          {status === "loading" && (
            <div className="max-h-[60vh] space-y-3 overflow-y-auto">
              <div className="flex items-center gap-3">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full bg-gold transition-all duration-500 ease-out"
                    style={{ width: `${Math.max(5, (doneSteps / Math.max(totalRelevant, 1)) * 100)}%` }}
                  />
                </div>
                {parsedCount > 0 && (
                  <span className="shrink-0 text-xs font-medium text-muted">{parsedCount.toLocaleString()} activos</span>
                )}
              </div>
              <StepList />
              {activeStep && subProgress.total > 0 && (
                <SubProgress done={subProgress.done} total={subProgress.total} label={subProgress.label} />
              )}
              {showCancelBtn && (
                <div className="flex justify-center">
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-100"
                  >
                    <Ban size={12} />
                    Cancelar enriquecimiento
                  </button>
                </div>
              )}
              {steps.find(s => s.id === "db-raw")?.status === "done" && (
                <p className="text-center text-[11px] text-green-600">
                  ✓ Activos ya disponibles en el CRM — puedes cerrar y volver más tarde
                </p>
              )}
              {excelEmptySummary && parsedCount > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50/90 px-3 py-2 text-[11px] leading-snug text-amber-950 whitespace-pre-line">
                  <span className="font-semibold text-amber-900">Resumen celdas vacías (importación):</span>
                  {"\n"}
                  {excelEmptySummary}
                </div>
              )}
            </div>
          )}

          {status === "success" && (
            <div className="max-h-[60vh] space-y-3 overflow-y-auto">
              <StepList compact />
              <div className="flex items-start gap-2 rounded-lg bg-green-50 px-3 py-2.5">
                <CheckCircle size={16} className="mt-0.5 shrink-0 text-green-500" />
                <div className="min-w-0 text-xs font-medium text-green-800">
                  <p>{message}</p>
                  {aiSummary && <p className="mt-1 font-normal text-green-600">{aiSummary}</p>}
                </div>
              </div>
              {excelEmptySummary && (
                <div className="rounded-lg border border-amber-200 bg-amber-50/90 px-3 py-2 text-[11px] leading-snug text-amber-950 whitespace-pre-line">
                  <span className="font-semibold text-amber-900">Celdas vacías en el Excel:</span>
                  {"\n"}
                  {excelEmptySummary}
                </div>
              )}
              {aiWarnings.length > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50">
                  <button
                    type="button"
                    onClick={() => setWarningsOpen((v) => !v)}
                    className="flex w-full items-center justify-between px-3 py-2 text-left"
                  >
                    <span className="text-xs font-medium text-amber-700">{aiWarnings.length} advertencia(s)</span>
                    {warningsOpen ? <ChevronUp size={14} className="text-amber-500" /> : <ChevronDown size={14} className="text-amber-500" />}
                  </button>
                  {warningsOpen && (
                    <div className="max-h-32 overflow-y-auto border-t border-amber-200 px-3 py-2">
                      {aiWarnings.slice(0, 20).map((w) => (
                        <div key={w.id} className="mb-1 last:mb-0">
                          <span className="text-[10px] font-semibold text-amber-800">{w.id}:</span>{" "}
                          <span className="text-[10px] text-amber-700">{w.warnings.join("; ")}</span>
                        </div>
                      ))}
                      {aiWarnings.length > 20 && <p className="mt-1 text-[10px] text-amber-500">…y {aiWarnings.length - 20} más</p>}
                    </div>
                  )}
                </div>
              )}
              <button
                type="button"
                onClick={handleClose}
                className="mx-auto block rounded-lg bg-navy px-4 py-2 text-sm font-medium text-white hover:bg-navy3"
              >
                Cerrar
              </button>
            </div>
          )}

          {status === "error" && (
            <div className="max-h-[60vh] space-y-3 overflow-y-auto">
              {steps.some(s => s.status !== "pending") && <StepList compact />}
              <div className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2.5">
                <AlertCircle size={16} className="mt-0.5 shrink-0 text-red-400" />
                <p className="text-xs text-red-600">{message}</p>
              </div>
              <div className="flex justify-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setStatus("idle"); setMessage(""); setAiSummary(""); setAiWarnings([]);
                    setParsedCount(0); setExcelEmptySummary(null); setSubProgress({ done: 0, total: 0, label: "" });
                    cancelledRef.current = false; setSteps(INITIAL_STEPS);
                  }}
                  className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-navy hover:bg-cream"
                >
                  Reintentar
                </button>
                <button
                  type="button"
                  onClick={handleClose}
                  className="rounded-lg bg-navy px-4 py-2 text-sm font-medium text-white hover:bg-navy3"
                >
                  Cerrar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
