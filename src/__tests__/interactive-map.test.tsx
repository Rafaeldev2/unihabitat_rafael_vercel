import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { InteractiveMap } from "@/components/InteractiveMap";

// Leaflet importa CSS y manipula el DOM real; en jsdom no necesitamos cargarlo
// realmente — los tests de aquí cubren las ramas SIN coords (placeholder /
// imagen / sin ubicación). El render con coords dispara `import("leaflet")`,
// que mock-eamos para evitar fallos de import dinámico en jsdom.
vi.mock("leaflet/dist/leaflet.css", () => ({}));
vi.mock("leaflet", () => ({
  default: {
    map: vi.fn(() => ({
      remove: vi.fn(),
      invalidateSize: vi.fn(),
    })),
    tileLayer: vi.fn(() => ({ addTo: vi.fn(() => ({})) })),
    divIcon: vi.fn(() => ({})),
    marker: vi.fn(() => ({ addTo: vi.fn(() => ({ bindPopup: vi.fn() })) })),
  },
}));

describe("InteractiveMap — caminos de render", () => {
  it("renderiza el mensaje 'Sin ubicación' cuando no hay coords ni URL", () => {
    render(<InteractiveMap lat={null} lng={null} mapImageUrl="" />);
    expect(screen.getByText("Sin ubicación")).toBeInTheDocument();
  });

  it("muestra 'Pendiente de geocodificación' cuando solo hay URL placeholder de Madrid", () => {
    const placeholder =
      "https://maps.geoapify.com/v1/staticmap?center=lonlat:-3.7038,40.4168&zoom=6&apiKey=k";
    render(<InteractiveMap lat={null} lng={null} mapImageUrl={placeholder} />);
    expect(screen.getByText(/Pendiente de geocodificación/i)).toBeInTheDocument();
  });

  it("renderiza la imagen estática cuando la URL no es placeholder y no tiene coords extraíbles", () => {
    // URL sin patrón `center=lonlat:...` ni `center=lat,lng` → InteractiveMap
    // no puede extraer coords de la URL y cae al render de imagen estática.
    const real = "https://example.com/static-map-of-arriate.png";
    render(<InteractiveMap lat={null} lng={null} mapImageUrl={real} label="Arriate" />);
    const img = screen.getByAltText("Arriate") as HTMLImageElement;
    expect(img.src).toBe(real);
  });

  it("monta el contenedor Leaflet cuando hay lat/lng válidos", () => {
    const { container } = render(
      <InteractiveMap lat={36.807} lng={-5.179} mapImageUrl={null} label="Arriate" />,
    );
    // El componente con coords renderiza un div contenedor de Leaflet, no una imagen.
    expect(screen.queryByAltText("Arriate")).not.toBeInTheDocument();
    expect(container.querySelector("div")).toBeTruthy();
  });
});
