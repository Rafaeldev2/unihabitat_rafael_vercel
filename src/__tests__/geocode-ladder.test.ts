import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Geoapify y DNP. El ladder solo orquesta llamadas; los pasos individuales
// son los que hacen el trabajo. Mockeamos los dos módulos a nivel del import.
const geocodeAddressLineMock = vi.fn();
const buildStaticMapUrlMock = vi.fn();
const fetchConsultaDnprcMock = vi.fn();
const isPlausibleCadastralRefMock = vi.fn();

vi.mock("@/lib/catastro/geoapify", async () => {
  const actual = await vi.importActual<typeof import("@/lib/catastro/geoapify")>("@/lib/catastro/geoapify");
  return {
    ...actual,
    geocodeAddressLine: (...args: unknown[]) => geocodeAddressLineMock(...args),
    buildStaticMapUrl: (...args: unknown[]) => buildStaticMapUrlMock(...args),
  };
});

vi.mock("@/lib/catastro/dnp", () => ({
  fetchConsultaDnprc: (...args: unknown[]) => fetchConsultaDnprcMock(...args),
  isPlausibleCadastralRef: (...args: unknown[]) => isPlausibleCadastralRefMock(...args),
  normalizeCadastralRef: (s: string) => s,
}));

import { geocodeLadder, __ladder_internal } from "@/lib/catastro/geocode-ladder";

beforeEach(() => {
  geocodeAddressLineMock.mockReset();
  buildStaticMapUrlMock.mockReset();
  fetchConsultaDnprcMock.mockReset();
  isPlausibleCadastralRefMock.mockReset();
  buildStaticMapUrlMock.mockImplementation((lon, lat) => `MAP(${lon},${lat})`);
});

describe("geocodeLadder", () => {
  it("paso 1 (direct): si la fila ya tiene lat/lng, no llama a Geoapify", async () => {
    const hit = await geocodeLadder({ id: "A1", lat: 40.41, lng: -3.7 });
    expect(hit?.method).toBe("direct");
    expect(hit?.lat).toBe(40.41);
    expect(hit?.lng).toBe(-3.7);
    expect(geocodeAddressLineMock).not.toHaveBeenCalled();
    expect(fetchConsultaDnprcMock).not.toHaveBeenCalled();
  });

  it("paso 2 (catastro): cae a Catastro DNP cuando hay catRef plausible", async () => {
    isPlausibleCadastralRefMock.mockReturnValue(true);
    fetchConsultaDnprcMock.mockResolvedValue({
      direccionCompleta: "Calle Real 1",
      municipio: "Granada",
      provincia: "Granada",
      codigoPostal: "18001",
      error: "",
    });
    geocodeAddressLineMock.mockResolvedValue({ lat: "37.17", lon: "-3.6" });

    const hit = await geocodeLadder({ id: "A1", catRef: "1234567890ABCDE" });
    expect(hit?.method).toBe("catastro");
    expect(hit?.canonical?.fullAddr).toBe("Calle Real 1");
    expect(hit?.canonical?.pob).toBe("Granada");
    expect(fetchConsultaDnprcMock).toHaveBeenCalledOnce();
  });

  it("paso 2 (catastro): si catRef no es plausible, salta al paso siguiente", async () => {
    isPlausibleCadastralRefMock.mockReturnValue(false);
    geocodeAddressLineMock.mockResolvedValue({ lat: "37.17", lon: "-3.6" });

    const hit = await geocodeLadder({ id: "A1", catRef: "BAD", fullAddr: "Calle Test 1" });
    expect(fetchConsultaDnprcMock).not.toHaveBeenCalled();
    expect(hit?.method).toBe("fulladdr");
  });

  it("paso 3 (fullAddr): geocodifica fullAddr con cp/pob/prov adjuntos", async () => {
    geocodeAddressLineMock.mockResolvedValueOnce({ lat: "36.8", lon: "-5.18" });
    const hit = await geocodeLadder({
      id: "A1", fullAddr: "Calle Luis Buñuel 1", cp: "29350", pob: "Arriate", prov: "Málaga",
    });
    expect(hit?.method).toBe("fulladdr");
    const text = geocodeAddressLineMock.mock.calls[0][0] as string;
    expect(text).toContain("Calle Luis Buñuel 1");
    expect(text).toContain("29350");
    expect(text).toContain("España");
  });

  it("paso 4 (reconstructed): construye dirección desde tvia+nvia+num cuando addr está vacío", async () => {
    geocodeAddressLineMock.mockResolvedValueOnce({ lat: "37.17", lon: "-3.6" });
    const hit = await geocodeLadder({
      id: "A1", addr: "", tvia: "CALLE", nvia: "REAL", num: "15",
      cp: "18119", pob: "Granada", prov: "Granada",
    });
    expect(hit?.method).toBe("reconstructed");
    const text = geocodeAddressLineMock.mock.calls[0][0] as string;
    expect(text).toContain("CALLE REAL 15");
  });

  it("paso 6 (coarse): degrada progresivamente cuando los pasos previos fallan", async () => {
    isPlausibleCadastralRefMock.mockReturnValue(false);
    // Todos los pasos previos devuelven null.
    geocodeAddressLineMock
      .mockResolvedValueOnce(null)              // structured (cp+pob+prov, paso 5)
      .mockResolvedValueOnce({ lat: "37", lon: "-3" }); // coarse:cp+pob+prov

    const hit = await geocodeLadder({
      id: "A1", cp: "18001", pob: "Granada", prov: "Granada",
    });
    expect(hit?.method).toBe("coarse:cp+pob+prov");
  });

  it("ningún paso resuelve: devuelve null", async () => {
    isPlausibleCadastralRefMock.mockReturnValue(false);
    geocodeAddressLineMock.mockResolvedValue(null);
    const hit = await geocodeLadder({ id: "A1", pob: "X", prov: "Y" });
    expect(hit).toBeNull();
  });

  it("trata '—' como vacío en todos los campos", async () => {
    isPlausibleCadastralRefMock.mockReturnValue(false);
    geocodeAddressLineMock.mockResolvedValue(null);
    const hit = await geocodeLadder({
      id: "A1", addr: "—", fullAddr: "—", cp: "—", pob: "—", prov: "—",
      tvia: "—", nvia: "—", num: "—", catRef: "—",
    });
    expect(hit).toBeNull();
    expect(geocodeAddressLineMock).not.toHaveBeenCalled();
  });
});

describe("ladder internal: tryDirect", () => {
  it("rechaza valores no finitos", async () => {
    expect(await __ladder_internal.tryDirect({ id: "A1", lat: NaN, lng: 1 })).toBeNull();
    expect(await __ladder_internal.tryDirect({ id: "A1", lat: 1, lng: Infinity })).toBeNull();
    expect(await __ladder_internal.tryDirect({ id: "A1" })).toBeNull();
  });
});
