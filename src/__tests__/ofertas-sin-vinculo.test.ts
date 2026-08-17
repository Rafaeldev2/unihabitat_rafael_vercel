import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth-server", () => ({
  requireAdminOrVendor: vi.fn(),
  requireAdmin: vi.fn(),
  getServerSession: vi.fn(),
}));

vi.mock("@/lib/email/send", () => ({
  sendEmail: vi.fn(async () => undefined),
}));

vi.mock("@/lib/email/templates", () => ({
  offerTemplate: vi.fn(() => ({ subject: "s", html: "h" })),
}));

import { requireAdminOrVendor } from "@/lib/auth-server";

const requireAdminOrVendorMock = vi.mocked(requireAdminOrVendor);

const UNLINKED_AGENT = {
  role: "vendedor" as const,
  nombre: "Agente Sin Fila",
  email: "agente-sin-fila@test.com",
  vendedorId: undefined,
};

function emptyVendedoresFrom() {
  const maybeSingle = vi.fn(async () => ({ data: null, error: null }));
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  return { select };
}

function makeCreateClient(fromImpl: ReturnType<typeof vi.fn>) {
  return {
    createClient: vi.fn(async () => ({ from: fromImpl })),
    createServiceClient: vi.fn(async () => ({ from: fromImpl })),
  };
}

describe("createOfertaAdmin sin vínculo", () => {
  beforeEach(() => {
    vi.resetModules();
    requireAdminOrVendorMock.mockReset();
  });

  it("agente no demo sin fila no falla en silencio", async () => {
    requireAdminOrVendorMock.mockResolvedValue(UNLINKED_AGENT);
    const insert = vi.fn(async () => ({ data: { id: "O1" }, error: null }));
    const assetMaybe = vi.fn(async () => ({ data: { id: "A1" }, error: null }));
    const vendMaybe = vi.fn(async () => ({ data: null, error: null }));

    const from = vi.fn((table: string) => {
      if (table === "assets") return { select: () => ({ eq: () => ({ maybeSingle: assetMaybe }) }) };
      if (table === "vendedores") return { select: () => ({ eq: () => ({ maybeSingle: vendMaybe }) }) };
      if (table === "ofertas") return { insert: () => ({ select: () => ({ single: insert }) }) };
      return {};
    });

    vi.doMock("@/lib/supabase/server", () => makeCreateClient(from));
    const { createOfertaAdmin } = await import("@/app/actions/ofertas");
    await expect(
      createOfertaAdmin({ assetId: "A1", propuestaEuros: 1000 }),
    ).rejects.toThrow(/no está vinculado a un registro de vendedores/);
    expect(insert).not.toHaveBeenCalled();
  });
});

describe("fetchOfertas sin vínculo", () => {
  beforeEach(() => {
    vi.resetModules();
    requireAdminOrVendorMock.mockReset();
  });

  it("agente no demo sin vendedores lanza error explícito", async () => {
    requireAdminOrVendorMock.mockResolvedValue(UNLINKED_AGENT);
    const from = vi.fn(() => emptyVendedoresFrom());
    vi.doMock("@/lib/supabase/server", () => makeCreateClient(from));
    const { fetchOfertas } = await import("@/app/actions/ofertas");
    await expect(fetchOfertas()).rejects.toThrow(
      /no está vinculado a un registro de vendedores/,
    );
  });
});
