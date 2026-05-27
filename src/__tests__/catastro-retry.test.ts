import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { fetchConsultaDnprc } from "@/lib/catastro/dnp";
import { classifyCatastroError } from "@/lib/catastro/errors";

// Referencia catastral plausible (20 chars alfanuméricos).
const REF = "5764401CF6556D0029AH";

/**
 * Construye una respuesta JSON mínima compatible con el parser de DNP que
 * resuelve sin error.
 */
function fakeSuccessJson(ref: string): Record<string, unknown> {
  return {
    consulta_dnprcResult: {
      bico: {
        bi: {
          idbi: { cn: "UR" },
          dt: { np: "MADRID", nm: "MADRID", locs: { lous: { lourb: { dir: {}, loint: {} } } } },
          ldt: `Localización: CALLE TEST ${ref}`,
          debi: {},
        },
        finca: { dff: {} },
        lcons: [],
      },
    },
  };
}

function mockResponse(status: number, body?: unknown): Response {
  if (status >= 400) {
    return new Response(null, { status });
  }
  return new Response(JSON.stringify(body ?? {}), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("fetchConsultaDnprc — retry y backoff", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    // Hacer que sleep sea instantáneo para que los tests no esperen segundos.
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  async function runWithFakeTime(promise: Promise<unknown>) {
    // Avanza temporizadores hasta que la promesa resuelva. Necesario porque el
    // retry hace `await sleep(...)` con setTimeout que estaría parado en
    // fakeTimers — runAllTimersAsync corre todos los pendientes.
    const settled = promise.then(v => ["ok", v] as const).catch(e => ["err", e] as const);
    await vi.runAllTimersAsync();
    return settled;
  }

  it("reintenta tras 503 transitorio y resuelve con éxito en el segundo intento", async () => {
    fetchMock
      .mockResolvedValueOnce(mockResponse(503))
      .mockResolvedValueOnce(mockResponse(200, fakeSuccessJson(REF)));

    const result = await runWithFakeTime(fetchConsultaDnprc(REF));
    const [tag, value] = await result;
    expect(tag).toBe("ok");
    expect((value as { error: string }).error).toBe("");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("tras 3 intentos consecutivos con 503, devuelve error HTTP 503 (no relanza)", async () => {
    fetchMock
      .mockResolvedValueOnce(mockResponse(503))
      .mockResolvedValueOnce(mockResponse(503))
      .mockResolvedValueOnce(mockResponse(503));

    const result = await runWithFakeTime(fetchConsultaDnprc(REF));
    const [tag, value] = await result;
    expect(tag).toBe("ok");
    expect((value as { error: string }).error).toBe("HTTP 503");
    expect(fetchMock).toHaveBeenCalledTimes(3); // 1 inicial + 2 retries (MAX_RETRIES=2)
  });

  it("HTTP 404 (permanente) no reintenta", async () => {
    fetchMock.mockResolvedValueOnce(mockResponse(404));

    const result = await runWithFakeTime(fetchConsultaDnprc(REF));
    const [tag, value] = await result;
    expect(tag).toBe("ok");
    expect((value as { error: string }).error).toBe("HTTP 404");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("AbortError de timeout reintenta y resuelve si el segundo intento responde", async () => {
    const abort = new Error("The operation was aborted");
    abort.name = "AbortError";
    fetchMock
      .mockRejectedValueOnce(abort)
      .mockResolvedValueOnce(mockResponse(200, fakeSuccessJson(REF)));

    const result = await runWithFakeTime(fetchConsultaDnprc(REF));
    const [tag, value] = await result;
    expect(tag).toBe("ok");
    expect((value as { error: string }).error).toBe("");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("ref no plausible no hace ninguna llamada HTTP", async () => {
    const result = await runWithFakeTime(fetchConsultaDnprc("xxx"));
    const [tag, value] = await result;
    expect(tag).toBe("ok");
    expect((value as { error: string }).error).toContain("Referencia catastral no válida");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("classifyCatastroError", () => {
  it("clasifica códigos HTTP 5xx/429 como http_5xx_429", () => {
    expect(classifyCatastroError("HTTP 503")).toBe("http_5xx_429");
    expect(classifyCatastroError("HTTP 429")).toBe("http_5xx_429");
    expect(classifyCatastroError("HTTP 502")).toBe("http_5xx_429");
  });

  it("clasifica 4xx como http_4xx", () => {
    expect(classifyCatastroError("HTTP 404")).toBe("http_4xx");
    expect(classifyCatastroError("HTTP 400")).toBe("http_4xx");
  });

  it("clasifica timeouts", () => {
    expect(classifyCatastroError("Error de conexión: tiempo de espera agotado")).toBe("timeout");
    expect(classifyCatastroError("Error al procesar: aborted")).toBe("timeout");
  });

  it("clasifica refs no encontradas", () => {
    expect(classifyCatastroError("No se encontró información del bien inmueble")).toBe("ref_not_found");
    expect(classifyCatastroError("Referencia catastral no válida o ausente")).toBe("ref_not_found");
  });

  it("clasifica estructura desconocida", () => {
    expect(classifyCatastroError("Estructura no reconocida. Claves: a, b")).toBe("structure_unknown");
  });

  it("clasifica errores de red", () => {
    expect(classifyCatastroError("Error al procesar: fetch failed")).toBe("network_error");
    expect(classifyCatastroError("Error al procesar: ECONNRESET")).toBe("network_error");
  });

  it("desconocidos van a 'other'", () => {
    expect(classifyCatastroError("Algo raro")).toBe("other");
    expect(classifyCatastroError("")).toBe("other");
  });
});
