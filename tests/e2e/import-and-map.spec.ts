import { test, expect } from "@playwright/test";

/**
 * Bug 3 — Tras importación, el mapa real debe estar persistido.
 *
 * Verificamos en el portal público de un activo conocido (variable de
 * entorno `PLAYWRIGHT_PUBLIC_ASSET_ID`) que:
 *
 *  - El componente `<InteractiveMap>` NO termina renderizando el texto
 *    "Pendiente de geocodificación" — eso indicaría que las coords no
 *    persistieron y hay regresión del Bug 3.
 *
 * El test se skipea cuando no hay un ID configurado para evitar falsos
 * negativos en entornos sin BD.
 */

test.describe("Bug 3 — mapa persistido tras importación", () => {
  test("el activo publicado NO muestra 'Pendiente de geocodificación'", async ({ page }) => {
    const realId = process.env.PLAYWRIGHT_PUBLIC_ASSET_ID;
    test.skip(!realId, "PLAYWRIGHT_PUBLIC_ASSET_ID no definido");
    await page.goto(`/portal/${realId}`);
    await expect(page.getByText(/Pendiente de geocodificación/)).not.toBeVisible();
  });
});
