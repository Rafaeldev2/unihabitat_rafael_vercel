import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/__tests__/setup.ts"],
    // El reporter por defecto sigue mostrando la salida TTY normal; añadimos
    // `./src/__tests__/log-reporter.ts` para volcar un log estructurado por
    // ejecución a `test-logs/<ts>-vitest.log` (revisable post-ejecución).
    reporters: ["default", "./src/__tests__/log-reporter.ts"],
    exclude: ["node_modules", ".next", "tests/e2e/**", "test-logs/**"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
