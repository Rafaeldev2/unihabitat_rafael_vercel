import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock de auth-server: todas las acciones admin deben pasar.
vi.mock("@/lib/auth-server", () => ({
  requireAdmin: vi.fn(async () => ({ role: "admin", nombre: "Admin", email: "admin@test", vendedorId: null })),
  requireAdminOrVendor: vi.fn(async () => ({ role: "admin", nombre: "Admin", email: "admin@test", vendedorId: null })),
  requireEditPermission: vi.fn(async () => ({ role: "admin", nombre: "Admin", email: "admin@test", vendedorId: null })),
  requireAssetAccess: vi.fn(async () => undefined),
}));

/** Factory de un cliente Supabase mock con cadena `.from().select().eq().maybeSingle()` etc. */
function makeSupabaseMock(behaviour: {
  selectMaybeSingle?: { data: unknown; error: unknown };
  updateError?: unknown;
  upsertError?: unknown;
  selectIn?: { data: unknown; error: unknown };
}) {
  const upsert = vi.fn(async () => ({ error: behaviour.upsertError ?? null }));
  const update = vi.fn(() => ({
    eq: vi.fn(async () => ({ error: behaviour.updateError ?? null })),
  }));
  const eq = vi.fn(() => ({
    maybeSingle: vi.fn(async () => behaviour.selectMaybeSingle ?? { data: null, error: null }),
  }));
  const inFn = vi.fn(async () => behaviour.selectIn ?? { data: [], error: null });
  const select = vi.fn(() => ({
    eq,
    in: inFn,
    order: vi.fn(async () => ({ data: [], error: null })),
  }));
  const from = vi.fn(() => ({ select, update, upsert }));
  return {
    client: { from },
    spies: { from, select, eq, inFn, upsert, update },
  };
}

describe("toggleAssetPub", () => {
  beforeEach(() => vi.resetModules());

  it("cambia pub=false → true y persiste fase='Publicado' / fase_c='fp-pub'", async () => {
    const sb = makeSupabaseMock({
      selectMaybeSingle: { data: { pub: false }, error: null },
    });
    vi.doMock("@/lib/supabase/server", () => ({
      createClient: vi.fn(async () => sb.client),
      createServiceClient: vi.fn(async () => sb.client),
    }));
    const { toggleAssetPub } = await import("@/app/actions/assets");

    const result = await toggleAssetPub("ASSET-1");
    expect(result).toBe(true);
    expect(sb.spies.update).toHaveBeenCalledWith(
      expect.objectContaining({ pub: true, fase: "Publicado", fase_c: "fp-pub" }),
    );
  });

  it("cambia pub=true → false y persiste fase='Suspendido' / fase_c='fp-sus'", async () => {
    const sb = makeSupabaseMock({
      selectMaybeSingle: { data: { pub: true }, error: null },
    });
    vi.doMock("@/lib/supabase/server", () => ({
      createClient: vi.fn(async () => sb.client),
      createServiceClient: vi.fn(async () => sb.client),
    }));
    const { toggleAssetPub } = await import("@/app/actions/assets");

    const result = await toggleAssetPub("ASSET-1");
    expect(result).toBe(false);
    expect(sb.spies.update).toHaveBeenCalledWith(
      expect.objectContaining({ pub: false, fase: "Suspendido", fase_c: "fp-sus" }),
    );
  });

  it("lanza 'Activo no encontrado' cuando la fila no existe", async () => {
    const sb = makeSupabaseMock({
      selectMaybeSingle: { data: null, error: null },
    });
    vi.doMock("@/lib/supabase/server", () => ({
      createClient: vi.fn(async () => sb.client),
      createServiceClient: vi.fn(async () => sb.client),
    }));
    const { toggleAssetPub } = await import("@/app/actions/assets");

    await expect(toggleAssetPub("MISSING")).rejects.toThrow(/Activo no encontrado/);
  });
});

describe("fetchAssetById (cliente anónimo, RLS public_read)", () => {
  beforeEach(() => vi.resetModules());

  it("devuelve null cuando la fila no existe", async () => {
    const sb = makeSupabaseMock({
      selectMaybeSingle: { data: null, error: null },
    });
    vi.doMock("@/lib/supabase/server", () => ({
      createClient: vi.fn(async () => sb.client),
      createServiceClient: vi.fn(async () => sb.client),
    }));
    const { fetchAssetById } = await import("@/app/actions/assets");

    const out = await fetchAssetById("X");
    expect(out).toBeNull();
  });

  it("propaga el error cuando Supabase devuelve error", async () => {
    const sb = makeSupabaseMock({
      selectMaybeSingle: { data: null, error: { message: "denied by RLS" } },
    });
    vi.doMock("@/lib/supabase/server", () => ({
      createClient: vi.fn(async () => sb.client),
      createServiceClient: vi.fn(async () => sb.client),
    }));
    const { fetchAssetById } = await import("@/app/actions/assets");

    await expect(fetchAssetById("X")).rejects.toThrow("denied by RLS");
  });
});

describe("upsertAssets — preserva pub/lat/lng existentes ante incoming vacío", () => {
  beforeEach(() => vi.resetModules());

  it("no sobrescribe pub=true ni borra lat/lng existentes cuando el incoming es vacío", async () => {
    const existing = {
      id: "A1", pub: true, lat: 36.807, lng: -5.179,
      map: "https://maps.geoapify.com/v1/staticmap?center=lonlat:-5.179,36.807&zoom=15&apiKey=k",
      addr: "C/ Real 1", pob: "Granada", prov: "Granada", cp: "18001",
    };

    const upsertSpy = vi.fn(async () => ({ error: null }));

    const fakeClient = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          in: vi.fn(async () => ({ data: [existing], error: null })),
        })),
        upsert: upsertSpy,
      })),
    };

    vi.doMock("@/lib/supabase/server", () => ({
      createClient: vi.fn(async () => fakeClient),
      createServiceClient: vi.fn(async () => fakeClient),
    }));

    const { upsertAssets } = await import("@/app/actions/assets");

    // Incoming "vacío": campos a "—" / null. NO debería pisar pub/lat/lng/map.
    const incoming = {
      id: "A1",
      pub: false, // mergeRowPreferNonEmpty solo override si incoming es `true`
      cat: "—", prov: "—", pob: "—", cp: "—", addr: "—",
      tip: "—", tipC: "—", fase: "—", faseC: "—", precio: null,
      fav: false, chk: false, sqm: null,
      tvia: "—", nvia: "—", num: "—", esc: "—", pla: "—", pta: "—",
      map: "",
      catRef: "—", clase: "—", uso: "—", bien: "—", supC: "—", supG: "—", coef: "—", ccaa: "—",
      fullAddr: "—", desc: "—",
      ownerName: "—", ownerTel: "—", ownerMail: "—",
      adm: { pip: "—", lin: "—", cat: "—", car: "—", cli: "—", id1: "—", con: "—", aid: "A1",
        loans: "—", tcol: "—", scol: "—", ccaa: "—", prov: "—", city: "—", zip: "—", addr: "—",
        finca: "—", reg: "—", cref: "—", ejud: "—", ejmap: "—", eneg: "—", ob: "—", sub: "—",
        deu: "—", cprev: "—", cpost: "—", dtot: "—", pest: "—", str: "—", liq: "—", avj: "—",
        mmap: "—", buck: "—", lbuck: "—", smf: "—", rsub: "—", conn: "—", conn2: "—" },
    };

    // El segundo argumento de upsertAssets es Asset[] — el cast ts-ignore es
    // aceptable aquí porque construimos una versión mínima válida.
    await upsertAssets([incoming as never]);

    expect(upsertSpy).toHaveBeenCalledTimes(1);
    const calls = upsertSpy.mock.calls as unknown as Array<unknown[]>;
    const payload = calls[0]?.[0] as Array<Record<string, unknown>>;
    expect(payload).toHaveLength(1);
    const merged = payload[0];

    // Las propiedades clave deben mantener los valores ya persistidos.
    expect(merged.pub).toBe(true);
    expect(merged.lat).toBe(36.807);
    expect(merged.lng).toBe(-5.179);
    expect(typeof merged.map).toBe("string");
    // El map se reconstruye desde lat/lng vía applyMapFromLatLng. La URL
    // resultante depende de si GEOAPIFY_KEY está disponible en el entorno
    // de test, por lo que validamos solo que NO se haya quedado con el
    // placeholder de Madrid (lat 40.4168 / lon -3.7038).
    expect(String(merged.map)).not.toContain("40.4168");
    expect(String(merged.map)).not.toContain("-3.7038");
  });
});
