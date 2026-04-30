import { describe, it, expect, beforeEach, vi } from "vitest";
import { logGeo, getRecentGeoEvents, clearGeoEvents, classifyFetchError, safeSnippet } from "@/lib/catastro/geoapify-logger";

describe("geoapify-logger", () => {
  beforeEach(() => {
    clearGeoEvents();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  it("almacena eventos con timestamp ISO en orden cronológico", () => {
    logGeo({ op: "test", reason: "ok", ok: true, assetId: "A1" });
    logGeo({ op: "test", reason: "no-match", ok: false, assetId: "A2" });
    const events = getRecentGeoEvents();
    expect(events).toHaveLength(2);
    expect(events[0].assetId).toBe("A1");
    expect(events[1].assetId).toBe("A2");
    expect(events[0].ts).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("limita el anillo a 200 entradas", () => {
    for (let i = 0; i < 250; i++) logGeo({ op: "test", reason: "ok", ok: true, assetId: `A${i}` });
    const events = getRecentGeoEvents();
    expect(events).toHaveLength(200);
    // Las primeras 50 deben haberse descartado.
    expect(events[0].assetId).toBe("A50");
    expect(events[199].assetId).toBe("A249");
  });

  it("imprime errores de configuración con console.error", () => {
    const errSpy = vi.spyOn(console, "error");
    logGeo({ op: "test", reason: "no-key", ok: false });
    expect(errSpy).toHaveBeenCalledTimes(1);
    expect(errSpy.mock.calls[0][0]).toContain("reason=no-key");
  });

  it("imprime errores transitorios con console.warn", () => {
    const warnSpy = vi.spyOn(console, "warn");
    logGeo({ op: "test", reason: "http_500", ok: false, status: 500 });
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toContain("status=500");
  });

  it("respeta el limit en getRecentGeoEvents", () => {
    for (let i = 0; i < 50; i++) logGeo({ op: "test", reason: "ok", ok: true, assetId: `A${i}` });
    const last10 = getRecentGeoEvents(10);
    expect(last10).toHaveLength(10);
    expect(last10[0].assetId).toBe("A40");
    expect(last10[9].assetId).toBe("A49");
  });
});

describe("classifyFetchError", () => {
  it("clasifica AbortError como abort", () => {
    const e = new Error("The user aborted a request.");
    e.name = "AbortError";
    expect(classifyFetchError(e)).toBe("abort");
  });

  it("clasifica TimeoutError como timeout", () => {
    const e = new Error("timed out");
    e.name = "TimeoutError";
    expect(classifyFetchError(e)).toBe("timeout");
  });

  it("clasifica errores de DNS/red como network", () => {
    expect(classifyFetchError(new Error("getaddrinfo ENOTFOUND api.geoapify.com"))).toBe("network");
    expect(classifyFetchError(new Error("fetch failed"))).toBe("network");
    expect(classifyFetchError(new Error("ECONNRESET"))).toBe("network");
  });

  it("clasifica errores de parse como json", () => {
    expect(classifyFetchError(new Error("Unexpected token < in JSON"))).toBe("json");
  });

  it("usa unknown para errores no reconocidos", () => {
    expect(classifyFetchError(new Error("something weird"))).toBe("unknown");
    expect(classifyFetchError(null)).toBe("unknown");
  });
});

describe("safeSnippet", () => {
  it("redacta apiKey de URLs", () => {
    const url = "https://api.geoapify.com/v1/geocode/search?text=Madrid&apiKey=SECRET123&limit=1";
    expect(safeSnippet(url)).not.toContain("SECRET123");
    expect(safeSnippet(url)).toContain("apiKey=<redacted>");
  });

  it("recorta a la longitud indicada", () => {
    expect(safeSnippet("a".repeat(500), 50)).toHaveLength(50);
  });

  it("devuelve cadena vacía para null/undefined", () => {
    expect(safeSnippet(null)).toBe("");
    expect(safeSnippet(undefined)).toBe("");
  });
});
