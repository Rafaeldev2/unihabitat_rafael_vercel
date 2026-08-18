import { describe, it, expect } from "vitest";
import { ADMIN_SECTIONS, defaultVendorPermissions } from "@/lib/permissions";
import { canEditSection, canViewSection } from "@/lib/auth-helpers";
import type { UserSession } from "@/lib/permissions";

const agente: UserSession = {
  email: "agente@ejemplo.com",
  role: "vendedor",
  nombre: "Agente",
  vendedorId: "v1",
};

describe("defaultVendorPermissions", () => {
  it("cubre todas las secciones del panel", () => {
    expect(defaultVendorPermissions().map((p) => p.section)).toEqual(
      ADMIN_SECTIONS.map((s) => s.id),
    );
  });

  it("deja ver Activos y Ofertas a un agente sin configuración explícita", () => {
    const perms = defaultVendorPermissions();
    expect(canViewSection(agente, "activos", perms)).toBe(true);
    expect(canViewSection(agente, "ofertas", perms)).toBe(true);
  });

  it("permite al agente registrar ofertas pero no editar activos", () => {
    const perms = defaultVendorPermissions();
    expect(canEditSection(agente, "ofertas", perms)).toBe(true);
    expect(canEditSection(agente, "activos", perms)).toBe(false);
  });

  it("mantiene ocultas el resto de secciones y la configuración", () => {
    const perms = defaultVendorPermissions();
    for (const section of ["compradores", "agentes", "tareas", "informes"] as const) {
      expect(canViewSection(agente, section, perms)).toBe(false);
    }
    expect(canViewSection(agente, "config", perms)).toBe(false);
  });
});
