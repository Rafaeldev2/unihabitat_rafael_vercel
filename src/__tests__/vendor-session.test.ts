import { describe, it, expect } from "vitest";
import { canViewSection } from "@/lib/auth-helpers";
import { defaultVendorPermissions } from "@/lib/permissions";
import type { UserSession } from "@/lib/permissions";

describe("canViewSection — agente con sesión Supabase", () => {
  const vendedorSession: UserSession = {
    email: "agente@test.com",
    role: "vendedor",
    nombre: "Agente Test",
    vendedorId: "v-1",
  };

  it("solo ve Activos con permisos por defecto", () => {
    const perms = defaultVendorPermissions();
    expect(canViewSection(vendedorSession, "activos", perms)).toBe(true);
    expect(canViewSection(vendedorSession, "compradores", perms)).toBe(false);
    expect(canViewSection(vendedorSession, "agentes", perms)).toBe(false);
    expect(canViewSection(vendedorSession, "config", perms)).toBe(false);
  });

  it("no trata sesión nula como admin (bug sidebar)", () => {
    expect(canViewSection(null, "activos", [])).toBe(false);
    expect(canViewSection(null, "compradores", [])).toBe(false);
  });
});
