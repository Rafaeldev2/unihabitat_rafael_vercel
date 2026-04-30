import { test, expect } from "@playwright/test";

/**
 * Bug 2 — Activo publicado debe renderizar en /portal/[id].
 *
 * Estrategia:
 *  1. Un activo inexistente (`/portal/__nonexistent__`) debe mostrar el
 *     candado con el texto "Esta propiedad no está disponible públicamente"
 *     — confirma que el guard del server component funciona.
 *  2. Si la variable `PLAYWRIGHT_PUBLIC_ASSET_ID` está definida (un ID real
 *     publicado en Supabase), confirmamos que la página renderiza el panel
 *     lateral con "Solicitar información" y NO el candado.
 *
 * El segundo escenario depende de tener un activo real en BD: lo skipeamos
 * limpiamente cuando no hay env var — así el test no falsea fallos en CI.
 */

test.describe("Bug 2 — portal asset detail", () => {
  test("activo inexistente: muestra el candado de privacidad", async ({ page }) => {
    await page.goto("/portal/__definitely_does_not_exist__");
    await expect(
      page.getByText(/Esta propiedad no está disponible públicamente/),
    ).toBeVisible();
  });

  test("activo publicado: renderiza la ficha (sin candado)", async ({ page }) => {
    const realId = process.env.PLAYWRIGHT_PUBLIC_ASSET_ID;
    test.skip(!realId, "PLAYWRIGHT_PUBLIC_ASSET_ID no definido — necesario un id real publicado en BD");
    await page.goto(`/portal/${realId}`);
    await expect(
      page.getByText(/Esta propiedad no está disponible públicamente/),
    ).not.toBeVisible();
    await expect(page.getByRole("button", { name: /Solicitar información/i }).first()).toBeVisible();
  });
});
