import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import PortalDetailClient from "@/app/portal/[id]/PortalDetailClient";
import type { Asset } from "@/lib/types";

// Tests del *cliente*: el guardado server-side ya está cubierto por
// `actions-assets.test.ts`; aquí confirmamos que cuando el server delega un
// asset publicado al cliente, el render NO bloquea con el candado.
vi.mock("@/hooks/usePortalAuth", () => ({
  usePortalAuth: () => ({ sensitiveVisible: false, currentUser: null, userResolved: true }),
}));
vi.mock("leaflet/dist/leaflet.css", () => ({}));
vi.mock("leaflet", () => ({ default: {
  map: vi.fn(() => ({ remove: vi.fn(), invalidateSize: vi.fn() })),
  tileLayer: vi.fn(() => ({ addTo: vi.fn(() => ({})) })),
  divIcon: vi.fn(() => ({})),
  marker: vi.fn(() => ({ addTo: vi.fn(() => ({ bindPopup: vi.fn() })) })),
} }));

function makeAsset(overrides: Partial<Asset> = {}): Asset {
  return {
    id: "TEST-1",
    cat: "NPL",
    prov: "Málaga",
    pob: "Arriate",
    cp: "29350",
    addr: "C/ Test 1",
    tip: "Vivienda",
    tipC: "tp-viv",
    fase: "Publicado",
    faseC: "fp-pub",
    precio: 100000,
    fav: false,
    chk: false,
    sqm: 100,
    tvia: "CALLE", nvia: "TEST", num: "1", esc: "—", pla: "—", pta: "—",
    map: null, lat: null, lng: null,
    catRef: "—", clase: "URBANO", uso: "Residencial", bien: "VIVIENDA", supC: "100 m²", supG: "—", coef: "—", ccaa: "Andalucía",
    fullAddr: "C/ Test 1, Arriate",
    desc: "Activo de prueba",
    ownerName: "—", ownerTel: "—", ownerMail: "—",
    adm: { pip: "—", lin: "—", cat: "NPL", car: "—", cli: "—", id1: "—", con: "—", aid: "TEST-1",
      loans: "—", tcol: "—", scol: "—", ccaa: "—", prov: "—", city: "—", zip: "—", addr: "—",
      finca: "—", reg: "—", cref: "—", ejud: "—", ejmap: "—", eneg: "—", ob: "—", sub: "—",
      deu: "—", cprev: "—", cpost: "—", dtot: "—", pest: "—", str: "—", liq: "—", avj: "—",
      mmap: "—", buck: "—", lbuck: "—", smf: "—", rsub: "—", conn: "—", conn2: "—" },
    pub: true,
    ...overrides,
  } as Asset;
}

describe("PortalDetailClient", () => {
  it("renderiza el activo publicado sin el candado de privacidad", () => {
    render(<PortalDetailClient asset={makeAsset()} siblings={[]} />);
    expect(screen.queryByText(/no está disponible públicamente/i)).not.toBeInTheDocument();
    // El título de la sección Descripción debe estar presente.
    expect(screen.getAllByText(/Descripción/i).length).toBeGreaterThan(0);
    // Botón "Solicitar información" — anclado al panel lateral.
    expect(screen.getAllByText(/Solicitar información/i).length).toBeGreaterThan(0);
  });

  it("muestra la sección de colaterales cuando hay siblings", () => {
    const sib = makeAsset({ id: "SIB-1", pob: "Otra Población", adm: { ...makeAsset().adm, con: "C-1" } });
    const main = makeAsset({ adm: { ...makeAsset().adm, con: "C-1" } });
    render(<PortalDetailClient asset={main} siblings={[sib]} />);
    expect(screen.getByText(/Colaterales \(2\)/)).toBeInTheDocument();
  });
});
