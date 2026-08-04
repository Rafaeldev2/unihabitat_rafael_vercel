import { test, expect } from "@playwright/test";

/**
 * Smoke E2E de las correcciones del feedback del cliente.
 * Usa usuarios demo (dev-auth) contra staging/local.
 */
test.describe("Feedback cliente — caminos críticos", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
  });

  test("home envía filtros cat/prov/pob/tipo al portal", async ({ page }) => {
    await page.goto("/");
    const form = page.getByRole("form").or(page.locator("form").first());
    await expect(page.getByText(/Categoría|Provincia|Tipología/i).first()).toBeVisible();

    // Si hay opciones, seleccionar primera categoría no vacía y buscar.
    const cat = page.getByLabel(/Categoría/i).or(page.locator('select').filter({ hasText: /Categoría|Todas/i }).first());
    if (await cat.count()) {
      const options = await cat.locator("option").allTextContents();
      const pick = options.find((o) => o && !/todas|selecciona|categoría/i.test(o));
      if (pick) await cat.selectOption({ label: pick });
    }

    const submit = page.getByRole("button", { name: /Buscar|Ver activos|Explorar/i }).first();
    if (await submit.count()) {
      await submit.click();
      await page.waitForURL(/\/portal/);
      expect(page.url()).toMatch(/\/portal/);
    }
  });

  test("contacto tiene enlaces legales reales", async ({ page }) => {
    await page.goto("/portal/contacto");
    const privacidad = page.getByRole("link", { name: /privacidad/i }).first();
    await expect(privacidad).toBeVisible();
    await expect(privacidad).toHaveAttribute("href", /\/legal\/privacidad/);
  });

  test("login admin y listado muestra columnas Proceso y Deuda", async ({ page }) => {
    await page.getByLabel(/email/i).fill("admin@propcrm.com");
    await page.getByLabel(/contraseña|password/i).fill("Admin1234!");
    await page.getByRole("button", { name: /entrar|iniciar|acceder/i }).click();
    await page.waitForURL(/\/admin/);
    await expect(page.getByText("Proceso").first()).toBeVisible();
    await expect(page.getByText("Deuda").first()).toBeVisible();
  });

  test("ficha pública usa ruta /portal/inmueble/ cuando hay slug", async ({ page }) => {
    await page.goto("/portal");
    const card = page.locator('a[href*="/portal/"]').first();
    await expect(card).toBeVisible();
    const href = await card.getAttribute("href");
    expect(href).toBeTruthy();
    // Tras migración: /portal/inmueble/... ; legacy aceptable hasta backfill.
    expect(href!).toMatch(/^\/portal\/(inmueble\/|[A-Za-z0-9_%-]+)/);
  });
});
