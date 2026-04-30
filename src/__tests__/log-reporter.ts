import { mkdirSync, writeFileSync, appendFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { Reporter, Task, File } from "vitest";

/**
 * Reporter Vitest que vuelca un log estructurado por suite a `test-logs/`.
 * Formato por línea: `[ISO] [vitest] [file] [test] [duration_ms] [PASS|FAIL] [details]`.
 *
 * El usuario puede inspeccionar `tail test-logs/<ts>-vitest.log` después de
 * cada `npm run test` y ver exactamente qué pasó sin parsear la salida TTY.
 */
export default class LogReporter implements Reporter {
  private logFile: string;
  private startedAt = Date.now();

  constructor() {
    const logsDir = join(process.cwd(), "test-logs");
    if (!existsSync(logsDir)) mkdirSync(logsDir, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    this.logFile = join(logsDir, `${ts}-vitest.log`);
    writeFileSync(
      this.logFile,
      `# Vitest run started at ${new Date().toISOString()}\n`,
    );
  }

  private write(parts: (string | number)[]) {
    const line = parts.map(p => `[${p}]`).join(" ") + "\n";
    appendFileSync(this.logFile, line);
  }

  onInit() {
    this.write([new Date().toISOString(), "vitest", "INIT", `cwd=${process.cwd()}`]);
  }

  onCollected(files: File[] = []) {
    for (const f of files) {
      this.write([new Date().toISOString(), "vitest", "COLLECTED", f.filepath, `tests=${countTests(f)}`]);
    }
  }

  onTaskUpdate(_packs: unknown[]) {
    // Vitest sends incremental updates en cada cambio de estado; aquí no
    // hacemos nada — el log final se construye en `onFinished` con todos los
    // resultados consolidados, lo que evita líneas duplicadas en el archivo.
  }

  onFinished(files: File[] = []) {
    let pass = 0;
    let fail = 0;
    let skip = 0;
    const durationMs = Date.now() - this.startedAt;

    const visit = (task: Task) => {
      if (task.type === "test") {
        const state = task.result?.state ?? "unknown";
        const dur = Math.round(task.result?.duration ?? 0);
        if (state === "pass") pass++;
        else if (state === "fail") fail++;
        else if (state === "skip" || state === "todo") skip++;

        const detail =
          task.result?.errors?.[0]?.message
            ?.replace(/\s+/g, " ")
            .slice(0, 240) ?? "";
        this.write([
          new Date().toISOString(),
          "vitest",
          relPath(task.file?.filepath ?? ""),
          task.name,
          `${dur}ms`,
          state.toUpperCase(),
          detail,
        ]);
      }
      if ("tasks" in task && Array.isArray((task as { tasks?: Task[] }).tasks)) {
        for (const sub of (task as { tasks: Task[] }).tasks) visit(sub);
      }
    };

    for (const f of files) visit(f as unknown as Task);

    this.write([
      new Date().toISOString(),
      "vitest",
      "SUMMARY",
      `pass=${pass}`,
      `fail=${fail}`,
      `skip=${skip}`,
      `total=${pass + fail + skip}`,
      `duration=${durationMs}ms`,
    ]);
  }
}

function relPath(abs: string): string {
  return abs.replace(process.cwd(), "").replace(/^[\\/]/, "") || "(unknown)";
}

function countTests(t: Task): number {
  if (t.type === "test") return 1;
  if ("tasks" in t && Array.isArray((t as { tasks?: Task[] }).tasks)) {
    return (t as { tasks: Task[] }).tasks.reduce((acc, s) => acc + countTests(s), 0);
  }
  return 0;
}

/**
 * Helper que registra un paso (sub-aserción) dentro de un test.
 * Uso:
 *   await step("paga al servicio", async () => { ... });
 * Cada paso se loguea con su duración y resultado al stdout (Vitest lo captura)
 * para que aparezca también en el log a través del Reporter.
 */
export async function step<T>(name: string, fn: () => Promise<T> | T): Promise<T> {
  const t0 = Date.now();
  try {
    const out = await fn();
    const dur = Date.now() - t0;
    // eslint-disable-next-line no-console
    console.log(`[step] [${name}] [${dur}ms] [PASS]`);
    return out;
  } catch (err) {
    const dur = Date.now() - t0;
    const msg = err instanceof Error ? err.message : String(err);
    // eslint-disable-next-line no-console
    console.log(`[step] [${name}] [${dur}ms] [FAIL] ${msg.replace(/\s+/g, " ").slice(0, 240)}`);
    throw err;
  }
}
