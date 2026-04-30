import { test, expect } from "@playwright/test";

/**
 * Bug 1 — Mocks no deben aparecer al refrescar.
 *
 * Verificamos:
 *  1. La página /admin (requiere dev-auth cookie) NO renderiza ninguno de los
 *     6 IDs de mock conocidos (UF34938, UF40346, 20257589, 4374518,
 *     BROK00792, BROK00826) cuando Supabase está disponible y vacío/normal.
 *  2. Tras un hard reload, lo mismo sigue siendo cierto.
 *
 * Si Supabase devuelve los mocks porque se sembraron deliberadamente, este
 * test fallará de forma esperada — significa que el seed de demo está activo.
 */

const MOCK_IDS = ["UF34938", "UF40346", "20257589", "4374518", "BROK00792", "BROK00826"];

test.describe("Bug 1 — refresh y mock data", () => {
  test.beforeEach(async ({ context }) => {
    // Inyectamos la cookie dev-auth con rol admin antes de cualquier navegación
    // para saltarnos el flujo de login durante los tests.
    await context.addCookies([{
      name: "dev-auth",
      value: encodeURIComponent(JSON.stringify({
        email: "e2e@test.local",
        role: "admin",
        nombre: "E2E Admin",
      })),
      url: "http://localhost:3000",
      sameSite: "Lax",
    }]);
  });

  test("La lista de activos NO muestra ningún ID de mock-data al cargar", async ({ page }) => {
    await page.goto("/admin");

    // Esperamos a que termine el estado de carga inicial (red o vacío).
    await page.waitForLoadState("networkidle");

    const html = await page.content();
    for (const id of MOCK_IDS) {
      expect(html, `mock id ${id} encontrado en /admin`).not.toContain(id);
    }
  });

  test("La lista de activos sigue libre de mocks tras hard reload", async ({ page }) => {
    await page.goto("/admin");
    await page.waitForLoadState("networkidle");
    await page.reload({ waitUntil: "networkidle" });

    const html = await page.content();
    for (const id of MOCK_IDS) {
      expect(html, `mock id ${id} encontrado tras refresh`).not.toContain(id);
    }
  });
});
