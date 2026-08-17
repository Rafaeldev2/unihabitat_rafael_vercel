import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
  createServiceClient: vi.fn(),
}));

import { createServiceClient } from "@/lib/supabase/server";
import {
  DEMO_VENDEDOR_EMAIL,
  ensureVendedorForDemoEmail,
} from "@/app/actions/ensure-vendedor-demo";
import { defaultVendorPermissions } from "@/lib/permissions";

const createServiceClientMock = vi.mocked(createServiceClient);

type SbSpies = {
  upsert: ReturnType<typeof vi.fn>;
  permUpsert: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
};

function makeSb(existingId: string | null): { client: { from: ReturnType<typeof vi.fn> }; spies: SbSpies } {
  const upsert = vi.fn(async () => ({ error: null }));
  const permUpsert = vi.fn(async () => ({ error: null }));
  const maybeSingle = vi.fn(async () => ({
    data: existingId ? { id: existingId } : null,
    error: null,
  }));

  const vendedoresTable = {
    select: () => ({ eq: () => ({ maybeSingle }) }),
    upsert,
  };
  const permissionsTable = { upsert: permUpsert };

  const from = vi.fn((table: string) => {
    if (table === "vendedores") return vendedoresTable;
    if (table === "vendedor_permissions") return permissionsTable;
    return {};
  });

  return { client: { from }, spies: { upsert, permUpsert, maybeSingle } };
}

describe("ensureVendedorForDemoEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rechaza emails que no son el demo de agente", async () => {
    await expect(
      ensureVendedorForDemoEmail("otro@test.com", "X"),
    ).rejects.toThrow(/solo aplica al email demo/);
  });

  it("devuelve id existente sin insertar", async () => {
    const sb = makeSb("V-EXIST");
    createServiceClientMock.mockResolvedValue(sb.client as never);
    const id = await ensureVendedorForDemoEmail(DEMO_VENDEDOR_EMAIL, "Carlos");
    expect(id).toBe("V-EXIST");
    expect(sb.spies.upsert).not.toHaveBeenCalled();
    expect(sb.spies.permUpsert).not.toHaveBeenCalled();
  });

  it("crea fila y permiso Ofertas; defaults globales intactos", async () => {
    const sb = makeSb(null);
    createServiceClientMock.mockResolvedValue(sb.client as never);
    const id = await ensureVendedorForDemoEmail(
      DEMO_VENDEDOR_EMAIL,
      "Carlos Martínez",
    );
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    expect(sb.spies.upsert).toHaveBeenCalled();
    const row = sb.spies.upsert.mock.calls[0][0] as {
      email: string;
      nombre: string;
    };
    expect(row.email).toBe(DEMO_VENDEDOR_EMAIL);
    expect(row.nombre).toBe("Carlos Martínez");

    const permRows = sb.spies.permUpsert.mock.calls[0][0] as Array<{
      section: string;
      can_view: boolean;
      can_edit: boolean;
    }>;
    const ofertas = permRows.find((p) => p.section === "ofertas");
    expect(ofertas?.can_view).toBe(true);
    expect(ofertas?.can_edit).toBe(true);
    expect(
      defaultVendorPermissions().find((d) => d.section === "ofertas")?.canView,
    ).toBe(false);
  });
});
