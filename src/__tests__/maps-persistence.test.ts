import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock auth-server (no auth requirements for these helpers, but the module
// is imported transitively by upstream actions in some paths).
vi.mock("@/lib/auth-server", () => ({
  requireAdmin: vi.fn(async () => ({ role: "admin", nombre: "Admin", email: "admin@test", vendedorId: null })),
}));

// Mock el ladder a nivel de módulo: `backfillMissingMaps` lo invoca,
// y queremos controlar exactamente qué hits devuelve por test.
const geocodeLadderMock = vi.fn();
vi.mock("@/lib/catastro/geocode-ladder", () => ({
  geocodeLadder: (...args: unknown[]) => geocodeLadderMock(...args),
}));

// Mock supabase server client. El upsert es un spy con comportamiento
// configurable por test (success, transient error, persistent error).
const upsertMock = vi.fn();
const selectInMock = vi.fn();

const supabaseMock = {
  from: vi.fn(() => ({
    upsert: upsertMock,
    select: vi.fn(() => ({
      in: selectInMock,
    })),
  })),
};

vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: vi.fn(async () => supabaseMock),
  createClient: vi.fn(async () => supabaseMock),
}));

beforeEach(() => {
  geocodeLadderMock.mockReset();
  upsertMock.mockReset();
  selectInMock.mockReset();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
});

const stub = {
  id: "A1", addr: "Calle Real 1", cp: "18001", pob: "Granada", prov: "Granada",
};

describe("backfillMissingMaps — persistencia", () => {
  it("devuelve {persisted, persistError:null, hits} cuando todo va bien", async () => {
    geocodeLadderMock.mockResolvedValue({
      method: "fulladdr", lat: 37.17, lng: -3.6, mapUrl: "MAP_URL", confidence: 0.85,
    });
    upsertMock.mockResolvedValue({ error: null });

    const { backfillMissingMaps } = await import("@/app/actions/maps");
    const r = await backfillMissingMaps([stub]);

    expect(r.persisted).toBe(1);
    expect(r.persistError).toBeNull();
    expect(r.hits["A1"]).toMatchObject({ lat: 37.17, lng: -3.6, method: "fulladdr" });
    expect(r.unresolved).toEqual([]);
  });

  it("captura el error de upsert sin tragarselo (no más best-effort silencioso)", async () => {
    geocodeLadderMock.mockResolvedValue({
      method: "fulladdr", lat: 37.17, lng: -3.6, mapUrl: "MAP_URL", confidence: 0.85,
    });
    upsertMock.mockResolvedValue({ error: { message: "permission denied for table assets" } });

    const { backfillMissingMaps } = await import("@/app/actions/maps");
    const r = await backfillMissingMaps([stub]);

    expect(r.persistError).toContain("permission denied");
    expect(r.persisted).toBe(0);
    // El hit SÍ se devuelve para que el cliente pueda mostrar coords aunque la BD haya fallado.
    expect(r.hits["A1"]).toBeDefined();
  });

  it("reintenta una sola vez ante errores transitorios (5xx, timeout)", async () => {
    geocodeLadderMock.mockResolvedValue({
      method: "fulladdr", lat: 37.17, lng: -3.6, mapUrl: "MAP_URL", confidence: 0.85,
    });
    upsertMock
      .mockResolvedValueOnce({ error: { message: "timeout 504 Gateway" } })
      .mockResolvedValueOnce({ error: null });

    const { backfillMissingMaps } = await import("@/app/actions/maps");
    const r = await backfillMissingMaps([stub]);

    expect(upsertMock).toHaveBeenCalledTimes(2);
    expect(r.persistError).toBeNull();
    expect(r.persisted).toBe(1);
  });

  it("NO reintenta errores no transitorios (RLS, schema)", async () => {
    geocodeLadderMock.mockResolvedValue({
      method: "fulladdr", lat: 37.17, lng: -3.6, mapUrl: "MAP_URL", confidence: 0.85,
    });
    upsertMock.mockResolvedValue({ error: { message: "permission denied for table assets (42501)" } });

    const { backfillMissingMaps } = await import("@/app/actions/maps");
    const r = await backfillMissingMaps([stub]);

    expect(upsertMock).toHaveBeenCalledTimes(1); // sin retry
    expect(r.persistError).toContain("permission denied");
  });

  it("registra unresolved cuando el ladder no resuelve", async () => {
    geocodeLadderMock.mockResolvedValue(null);

    const { backfillMissingMaps } = await import("@/app/actions/maps");
    const r = await backfillMissingMaps([stub]);

    expect(r.unresolved).toEqual(["A1"]);
    expect(r.persisted).toBe(0);
    expect(r.hits).toEqual({});
    // No upsert si no hubo hits.
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it("devuelve OSM-static fallback cuando el ladder no produce mapUrl (sin clave Geoapify)", async () => {
    geocodeLadderMock.mockResolvedValue({
      method: "fulladdr", lat: 37.17, lng: -3.6, mapUrl: "", confidence: 0.85,
    });
    upsertMock.mockResolvedValue({ error: null });

    const { backfillMissingMaps } = await import("@/app/actions/maps");
    const r = await backfillMissingMaps([stub]);

    expect(r.hits["A1"].map).toContain("staticmap.openstreetmap.de");
  });
});
