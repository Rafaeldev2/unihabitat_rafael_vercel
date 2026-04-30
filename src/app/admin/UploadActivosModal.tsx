"use client";

import { useState, useRef, useCallback } from "react";
import { useApp } from "@/lib/context";
import { parseExcelFile, extractRawPreview, parseWithMapping, parseExcelHeuristic, type ParseExcelResult } from "@/lib/normalize-excel";
import { enrichAssetsBatch } from "@/app/actions/catastro";
import type { CatastroEnrichFailure } from "@/app/actions/catastro";
import { validateAssetsBatch } from "@/app/actions/claude";
import type { ClaudeAssetResult } from "@/app/actions/claude";
import { upsertAssets, fetchAssetsByIds } from "@/app/actions/assets";
import { backfillUploadedMaps } from "@/app/actions/maps";
import { detectFormatWithClaude } from "@/app/actions/claude-format-detect";
import type { Asset } from "@/lib/types";
import { computeEmptyStatsFromAssets, formatExcelImportEmptySummary } from "@/lib/excel-raw-utils";
import {
  X, Upload, Loader2, CheckCircle, AlertCircle,
  ChevronDown, ChevronUp, Sparkles, FileSpreadsheet,
  Brain, MapPin, Database, Clock, Ban, Zap, Copy, Download,
} from "lucide-react";

// ─── Tunables ────────────────────────────────────────────────────────────────
const AI_BATCH_SIZE = 15;          // activos por llamada Claude (combinado con max_tokens=8192 deja margen para lotes con warnings + summary sin truncar)
const AI_CONCURRENCY = 3;          // llamadas Claude en paralelo
const AI_SKIP_THRESHOLD = 500;     // omitir IA para archivos > N activos
const CATASTRO_BATCH_SIZE = 30;    // activos por llamada Catastro (era 15)
const CATASTRO_CONCURRENCY = 6;    // llamadas Catastro en paralelo
const DB_BATCH_SIZE = 100;         // activos por upsert a Supabase (era 50)
const DB_CONCURRENCY = 4;          // upserts paralelos
// ─────────────────────────────────────────────────────────────────────────────

interface FailedUpsert { id: string; reason: string; }

type LogLevel = "info" | "warn" | "error";
interface LogEntry { ts: string; level: LogLevel; msg: string; }

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
  const { addAssets, assets: existing, refreshAssets } = useApp();
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [steps, setSteps] = useState<PipelineStep[]>(INITIAL_STEPS);
  const [parsedCount, setParsedCount] = useState(0);
  const [aiSummary, setAiSummary] = useState("");
  const [aiWarnings, setAiWarnings] = useState<ClaudeAssetResult[]>([]);
  const [warningsOpen, setWarningsOpen] = useState(false);
  const [subProgress, setSubProgress] = useState({ done: 0, total: 0, label: "" });
  const [excelEmptySummary, setExcelEmptySummary] = useState<string | null>(null);
  const [failedUpserts, setFailedUpserts] = useState<FailedUpsert[]>([]);
  const [failedOpen, setFailedOpen] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const cancelledRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const logsRef = useRef<LogEntry[]>([]);

  /**
   * Acumula un evento del pipeline de upload. Mirroring inmediato a la
   * consola del navegador (console.log/warn/error) para que el usuario lo
   * vea en tiempo real en DevTools, y guardado en estado para descarga.
   */
  const pushLog = useCallback((level: LogLevel, msg: string) => {
    const ts = new Date().toISOString();
    const entry: LogEntry = { ts, level, msg };
    logsRef.current.push(entry);
    setLogs(prev => [...prev, entry]);
    const tag = "[upload]";
    if (level === "error") console.error(tag, ts, msg);
    else if (level === "warn") console.warn(tag, ts, msg);
    else console.log(tag, ts, msg);
  }, []);

  const downloadLog = useCallback(() => {
    const lines = logsRef.current.map(l => `[${l.ts}] ${l.level.toUpperCase()} ${l.msg}`);
    const blob = new Blob([lines.join("\n") + "\n"], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `propcrm-upload-${new Date().toISOString().replace(/[:.]/g, "-")}.log`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

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
    setFailedUpserts([]);
    setFailedOpen(false);
    setLogs([]);
    logsRef.current = [];
    setParsedCount(0);
    setExcelEmptySummary(null);
    pushLog("info", `Inicio de upload: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`);

    const finalFailures: FailedUpsert[] = [];
    setSubProgress({ done: 0, total: 0, label: "" });
    cancelledRef.current = false;
    setSteps(INITIAL_STEPS.map(s => ({ ...s, status: "pending", elapsed: undefined })));

    try {
      // ── Step 1: Parse Excel ──────────────────────────────────────────────
      const t0 = Date.now();
      updateStep("parse", { status: "active", detail: `Leyendo ${file.name}…` });
      const diagResult = await parseExcelFile(file, { diag: true }) as ParseExcelResult;
      let parsed = diagResult.assets;
      pushLog("info", `Parser estructurado: ${parsed.length} activos · hojas: ${diagResult.sheetDiag.map(s => `${s.sheet}=${s.format}(${s.rows})`).join(", ")}`);
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
      // Si la IA falla o no detecta formato, NO abortamos: caemos al
      // parseo heurístico (sin Claude) para que siempre se cargue algo.
      if (parsed.length === 0) {
        const t1 = Date.now();
        updateStep("ai-detect", { status: "active", detail: "Enviando cabeceras a Claude…" });
        let aiUsed = false;
        try {
          const preview = await extractRawPreview(file);
          pushLog("info", `Detección IA: enviando cabeceras de ${preview.length} hoja(s)`);
          const detection = await detectFormatWithClaude(preview);
          pushLog("info", `Detección IA: confidence=${detection.confidence}, descripción="${detection.description}"`);

          if (detection.confidence > 0.5 && Object.keys(detection.mapping).length > 0) {
            updateStep("ai-detect", { status: "active", detail: `Formato detectado (${detection.description}). Parseando…` });
            const aiParsed = await parseWithMapping(file, detection.mapping);
            if (aiParsed.length > 0) {
              parsed = aiParsed;
              aiUsed = true;
              updateStep("ai-detect", { status: "done", detail: `${parsed.length} activo(s) extraídos con IA`, elapsed: Date.now() - t1 });
            } else {
              updateStep("ai-detect", { status: "skipped", detail: `IA detectó formato pero no extrajo filas — uso heurística`, elapsed: Date.now() - t1 });
              pushLog("warn", "IA detectó formato pero parseWithMapping devolvió 0 filas; cayendo a heurística");
            }
          } else {
            updateStep("ai-detect", { status: "skipped", detail: `IA no detectó formato (conf=${detection.confidence.toFixed(2)}) — uso heurística`, elapsed: Date.now() - t1 });
            pushLog("warn", `IA confidence ${detection.confidence} bajo umbral 0.5; cayendo a heurística`);
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          updateStep("ai-detect", { status: "error", detail: `IA no disponible: ${msg.slice(0, 80)} — uso heurística`, elapsed: Date.now() - t1 });
          pushLog("error", `Detección IA falló: ${msg}`);
        }

        // ── Step 1c: Fallback heurístico SIN Claude ──────────────────────
        // Funciona aunque la IA esté caída, la clave sea inválida o no haya internet.
        if (!aiUsed) {
          try {
            const heuristic = await parseExcelHeuristic(file);
            pushLog("info", `Heurística: ${heuristic.assets.length} activos extraídos de ${heuristic.totalRows} filas en ${heuristic.sheets.length} hoja(s)`);
            if (heuristic.assets.length > 0) {
              parsed = heuristic.assets;
            }
          } catch (err) {
            pushLog("error", `Heurística falló: ${err instanceof Error ? err.message : String(err)}`);
          }
        }

        if (parsed.length === 0) {
          setStatus("error");
          setMessage("No se encontraron filas válidas en el archivo. Comprueba que tenga datos con cabeceras reconocibles.");
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
          if (result.errors.length > 0) {
            pushLog("error", `upsertAssets batch error: ${result.errors.join(" | ")}`);
          }
          updateStep("db-raw", { status: "active", detail: `${rawSaved}/${parsed.length} activos guardados…` });
        }, DB_CONCURRENCY);

        if (rawSaved > 0) {
          await refreshAssets();
        }

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
        pushLog("error", `Step 2 (db-raw) lanzó: ${msg}`);
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
          // Bug 3: cada batch capturado individualmente. Si runConcurrent
          // rechaza por completo (p.ej. requireAdmin throw → sesión perdida),
          // marcamos TODOS los IDs como fallidos para que el banner rojo se
          // dispare y el usuario sepa que la persistencia final falló.
          try {
            await runConcurrent(dbBatches, async (batch) => {
              try {
                const result = await upsertAssets(batch);
                if (result.errors.length > 0 && result.inserted + result.updated < batch.length) {
                  for (const a of batch) {
                    if (!finalFailures.some(f => f.id === a.id)) {
                      finalFailures.push({ id: a.id, reason: result.errors[0] ?? "upsert final falló" });
                    }
                  }
                }
              } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                for (const a of batch) {
                  if (!finalFailures.some(f => f.id === a.id)) {
                    finalFailures.push({ id: a.id, reason: msg });
                  }
                }
              }
            }, DB_CONCURRENCY);
          } catch (err) {
            console.error("[upload] orquestación de upsert final falló:", err);
            const msg = err instanceof Error ? err.message : String(err);
            for (const a of toSave) {
              if (!finalFailures.some(f => f.id === a.id)) {
                finalFailures.push({ id: a.id, reason: msg });
              }
            }
          }
        }
      }

      // Bug 3: verificación post-upload. Comparamos los IDs parseados con los
      // que realmente están en la BD. Cualquier ID ausente entra en
      // finalFailures con razón clara — convierte fallo silencioso en visible.
      try {
        const expectedIds = parsed.map(a => a.id);
        const present = await fetchAssetsByIds(expectedIds);
        const presentIds = new Set(present.map(a => a.id));
        for (const id of expectedIds) {
          if (!presentIds.has(id) && !finalFailures.some(f => f.id === id)) {
            finalFailures.push({ id, reason: "no encontrado en BD tras el upsert" });
          }
        }
      } catch (err) {
        console.error("[upload] verificación post-upsert falló:", err);
      }

      if (finalFailures.length > 0) {
        setFailedUpserts(finalFailures);
        parts.push(`⚠ ${finalFailures.length} activo(s) NO se guardaron.`);
        pushLog("error", `${finalFailures.length} activos NO persistidos. IDs: ${finalFailures.slice(0, 10).map(f => f.id).join(", ")}${finalFailures.length > 10 ? "…" : ""}`);
      } else {
        pushLog("info", `Verificación post-upload OK: ${parsed.length} activos confirmados en BD`);
      }

      // Bug 3: geocodifica server-side los activos recién importados para
      // que el mapa real (lat/lng + URL Geoapify) ya esté persistido en BD
      // antes del primer refresh. Sin esto, el placeholder de Madrid quedaba
      // visible hasta que el cliente disparara el backfill. La acción usa
      // ahora el "ladder" de 7 pasos (direct → catastro → fullAddr → addr/recon
      // → structured → coarse) y reporta de forma diferenciada qué se geocodificó,
      // qué quedó sin resolver y si el upsert de BD falló.
      try {
        const persistedIds = parsed
          .map(a => a.id)
          .filter(id => !finalFailures.some(f => f.id === id));
        if (persistedIds.length > 0) {
          const r = await backfillUploadedMaps(persistedIds);

          const methodSummary = Object.entries(r.byMethod)
            .map(([m, n]) => `${m}=${n}`)
            .join(" ");
          pushLog(
            "info",
            `Geocodificación post-import: ${r.persisted} persistidos / ${r.geocoded} geocodificados / ${r.unresolved} sin resultado` +
              (methodSummary ? ` · métodos: ${methodSummary}` : ""),
          );

          if (r.persistError) {
            pushLog(
              "error",
              `Mapas: error al persistir en Supabase — ${r.persistError}. Revisa RLS, permisos del service role y conectividad.`,
            );
          }
          if (r.driftIds.length > 0) {
            pushLog(
              "warn",
              `Mapas: ${r.driftIds.length} fila(s) geocodificada(s) sin lat/lng confirmados en BD (drift): ` +
                `${r.driftIds.slice(0, 8).join(", ")}${r.driftIds.length > 8 ? "…" : ""}`,
            );
          }
          if (r.unresolved > 0) {
            pushLog(
              "warn",
              `Mapas: ${r.unresolved} activo(s) sin coordenadas tras el ladder. ` +
                `Verifica direcciones en la ficha o usa "Forzar" si tienen referencia catastral.`,
            );
          }
          if (r.geocoded === 0 && r.requested > 0) {
            pushLog(
              "error",
              `Mapas: 0 activos geocodificados. Comprueba GEOAPIFY_API_KEY en .env.local y reinicia npm run dev. ` +
                `Diagnóstico rápido: /admin/config → "Probar Geoapify".`,
            );
          }
        }
      } catch (err) {
        console.error("[upload] backfillUploadedMaps falló:", err);
        pushLog("warn", "Geocodificación post-import falló (los mapas se intentarán de nuevo al cargar la lista).");
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
              {failedUpserts.length > 0 && (
                <FailedUpsertsBanner
                  failures={failedUpserts}
                  total={parsedCount}
                  open={failedOpen}
                  onToggle={() => setFailedOpen(v => !v)}
                />
              )}
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
              <div className="flex justify-center gap-2">
                {logs.length > 0 && (
                  <button
                    type="button"
                    onClick={downloadLog}
                    className="flex items-center gap-1.5 rounded-lg border border-border bg-white px-3.5 py-2 text-xs font-medium text-navy transition-colors hover:bg-cream"
                  >
                    <Download size={13} /> Descargar log ({logs.length})
                  </button>
                )}
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

          {status === "error" && (
            <div className="max-h-[60vh] space-y-3 overflow-y-auto">
              {failedUpserts.length > 0 && (
                <FailedUpsertsBanner
                  failures={failedUpserts}
                  total={parsedCount}
                  open={failedOpen}
                  onToggle={() => setFailedOpen(v => !v)}
                />
              )}
              {steps.some(s => s.status !== "pending") && <StepList compact />}
              <div className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2.5">
                <AlertCircle size={16} className="mt-0.5 shrink-0 text-red-400" />
                <p className="text-xs text-red-600">{message}</p>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                {logs.length > 0 && (
                  <button
                    type="button"
                    onClick={downloadLog}
                    className="flex items-center gap-1.5 rounded-lg border border-border bg-white px-3.5 py-2 text-xs font-medium text-navy transition-colors hover:bg-cream"
                  >
                    <Download size={13} /> Descargar log ({logs.length})
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setStatus("idle"); setMessage(""); setAiSummary(""); setAiWarnings([]);
                    setFailedUpserts([]); setFailedOpen(false);
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

function FailedUpsertsBanner({
  failures,
  total,
  open,
  onToggle,
}: {
  failures: FailedUpsert[];
  total: number;
  open: boolean;
  onToggle: () => void;
}) {
  const copyIds = async () => {
    try {
      await navigator.clipboard.writeText(failures.map(f => f.id).join("\n"));
    } catch {
      /* ignorar — el usuario puede seleccionar manualmente */
    }
  };
  return (
    <div className="rounded-lg border border-red-300 bg-red-50">
      <div className="flex items-start gap-2 px-3 py-2.5">
        <AlertCircle size={16} className="mt-0.5 shrink-0 text-red-500" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-red-700">
            {failures.length} de {total} activo(s) no se guardaron
          </p>
          <p className="mt-0.5 text-[11px] text-red-600">
            Estas filas NO están en la base de datos. Al refrescar la página no aparecerán.
          </p>
        </div>
        <button
          type="button"
          onClick={copyIds}
          className="flex shrink-0 items-center gap-1 rounded-md border border-red-300 bg-white px-2 py-1 text-[11px] font-medium text-red-700 transition-colors hover:bg-red-100"
          title="Copiar IDs al portapapeles"
        >
          <Copy size={11} /> Copiar IDs
        </button>
        <button
          type="button"
          onClick={onToggle}
          className="flex shrink-0 items-center rounded-md p-1 text-red-500 transition-colors hover:bg-red-100"
          aria-label={open ? "Ocultar detalles" : "Mostrar detalles"}
        >
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>
      {open && (
        <div className="max-h-40 overflow-y-auto border-t border-red-200 px-3 py-2">
          {failures.slice(0, 100).map(f => (
            <div key={f.id} className="mb-1 last:mb-0 flex gap-2 text-[10px] leading-snug">
              <span className="font-semibold text-red-800">{f.id}</span>
              <span className="text-red-600">{f.reason}</span>
            </div>
          ))}
          {failures.length > 100 && (
            <p className="mt-1 text-[10px] text-red-500">…y {failures.length - 100} más</p>
          )}
        </div>
      )}
    </div>
  );
}
