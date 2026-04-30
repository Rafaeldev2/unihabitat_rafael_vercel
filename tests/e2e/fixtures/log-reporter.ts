import { mkdirSync, writeFileSync, appendFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type {
  Reporter,
  TestCase,
  TestResult,
  FullConfig,
  Suite,
  FullResult,
} from "@playwright/test/reporter";

/**
 * Reporter Playwright complementario al `list`/`html` por defecto.
 * Vuelca un log estructurado a `test-logs/<ts>-e2e.log` para que el usuario
 * pueda inspeccionar paso a paso lo que el navegador hizo, sin parsear el
 * HTML report.
 *
 * Formato:
 *   [ISO] [e2e] [spec] [test] [duration_ms] [PASS|FAIL|SKIP|FLAKY] [details]
 */
export default class E2ELogReporter implements Reporter {
  private logFile = "";

  onBegin(config: FullConfig, suite: Suite) {
    const logsDir = join(process.cwd(), "test-logs");
    if (!existsSync(logsDir)) mkdirSync(logsDir, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    this.logFile = join(logsDir, `${ts}-e2e.log`);
    writeFileSync(
      this.logFile,
      `# Playwright run started at ${new Date().toISOString()} — ${suite.allTests().length} test(s)\n`,
    );
    this.write(["BEGIN", `projects=${config.projects.map(p => p.name).join(",")}`]);
  }

  onTestBegin(test: TestCase) {
    this.write([
      "BEGIN_TEST",
      relPath(test.location.file),
      test.title,
    ]);
  }

  onStepEnd(test: TestCase, _result: TestResult, step: { title: string; duration: number; error?: { message?: string } }) {
    if (step.title.startsWith("expect.") || step.title === "After Hooks" || step.title === "Before Hooks") return;
    const outcome = step.error ? "FAIL" : "PASS";
    const detail = step.error?.message?.replace(/\s+/g, " ").slice(0, 240) ?? "";
    this.write([
      "STEP",
      relPath(test.location.file),
      test.title,
      step.title,
      `${Math.round(step.duration)}ms`,
      outcome,
      detail,
    ]);
  }

  onTestEnd(test: TestCase, result: TestResult) {
    const status: string = result.status;
    const outcome = (() => {
      if (status === "passed") return "PASS";
      if (status === "failed") return "FAIL";
      if (status === "timedOut") return "FAIL";
      if (status === "skipped") return "SKIP";
      if (status === "interrupted") return "FAIL";
      return status.toUpperCase();
    })();
    const detail = result.errors[0]?.message?.replace(/\s+/g, " ").slice(0, 240) ?? "";
    this.write([
      "END_TEST",
      relPath(test.location.file),
      test.title,
      `${Math.round(result.duration)}ms`,
      outcome,
      detail,
    ]);
  }

  onEnd(result: FullResult) {
    this.write(["SUMMARY", `status=${result.status}`, `duration=${Math.round(result.duration)}ms`]);
  }

  private write(parts: string[]) {
    const line =
      [`${new Date().toISOString()}`, "e2e", ...parts]
        .map(p => `[${p}]`)
        .join(" ") + "\n";
    appendFileSync(this.logFile, line);
  }
}

function relPath(abs: string): string {
  return abs.replace(process.cwd(), "").replace(/^[\\/]/, "") || "(unknown)";
}
