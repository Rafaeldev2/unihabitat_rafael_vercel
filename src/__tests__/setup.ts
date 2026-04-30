import "@testing-library/jest-dom/vitest";

// jsdom no implementa IntersectionObserver. Varios componentes de UI lo usan
// (sticky-tabs en el portal, lazy-load de tarjetas, etc.). Lo stub-eamos a
// nivel global para que esos tests no rompan en el primer render.
class IntersectionObserverStub {
  observe(): void { /* noop */ }
  unobserve(): void { /* noop */ }
  disconnect(): void { /* noop */ }
  takeRecords(): IntersectionObserverEntry[] { return []; }
  root: Element | Document | null = null;
  rootMargin = "";
  thresholds: ReadonlyArray<number> = [];
}
if (typeof globalThis.IntersectionObserver === "undefined") {
  (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver =
    IntersectionObserverStub;
}
