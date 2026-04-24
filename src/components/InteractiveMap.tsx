"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import { isPlaceholderMapUrl } from "@/lib/map-default";

function extractCoordsFromUrl(url?: string | null): { lat: number; lng: number } | null {
  if (!url) return null;
  const m = url.match(/center=lonlat:([-\d.]+),([-\d.]+)/);
  if (m) {
    const lng = parseFloat(m[1]);
    const lat = parseFloat(m[2]);
    if (!isNaN(lat) && !isNaN(lng)) return { lat, lng };
  }
  const m2 = url.match(/center=([-\d.]+),([-\d.]+)/);
  if (m2) {
    const lat = parseFloat(m2[1]);
    const lng = parseFloat(m2[2]);
    if (!isNaN(lat) && !isNaN(lng)) return { lat, lng };
  }
  return null;
}

interface InteractiveMapProps {
  lat?: number | null;
  lng?: number | null;
  mapImageUrl?: string | null;
  label?: string;
  className?: string;
}

export function InteractiveMap({ lat: rawLat, lng: rawLng, mapImageUrl, label, className = "" }: InteractiveMapProps) {
  /** Nunca extraer el centro de una URL "España/Madrid" (placeholder): eso fijaba Malina en el primer paint. */
  const fromUrl =
    rawLat != null && rawLng != null
      ? null
      : mapImageUrl && !isPlaceholderMapUrl(mapImageUrl)
        ? extractCoordsFromUrl(mapImageUrl)
        : null;
  const lat = rawLat ?? fromUrl?.lat ?? null;
  const lng = rawLng ?? fromUrl?.lng ?? null;
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  const hasCoords = typeof lat === "number" && typeof lng === "number" && !isNaN(lat) && !isNaN(lng);

  useEffect(() => {
    if (!hasCoords || !containerRef.current) return;

    let cancelled = false;

    (async () => {
      try {
        const L = (await import("leaflet")).default;
        await import("leaflet/dist/leaflet.css");

        if (cancelled || !containerRef.current) return;

        if (mapRef.current) {
          mapRef.current.remove();
          mapRef.current = null;
        }

        const map = L.map(containerRef.current, {
          center: [lat!, lng!],
          zoom: 15,
          scrollWheelZoom: false,
          zoomControl: true,
          attributionControl: false,
        });

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
        }).addTo(map);

        const icon = L.divIcon({
          html: `<div style="background:#c8a455;width:28px;height:28px;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
          </div>`,
          className: "",
          iconSize: [28, 28],
          iconAnchor: [14, 28],
        });

        const marker = L.marker([lat!, lng!], { icon }).addTo(map);
        if (label) marker.bindPopup(`<b>${label}</b>`);

        mapRef.current = map;
        setLoaded(true);

        setTimeout(() => map.invalidateSize(), 100);
      } catch {
        if (!cancelled) setError(true);
      }
    })();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [lat, lng, label, hasCoords]);

  if (!hasCoords) {
    const m = mapImageUrl?.trim() ?? "";
    if (m && !isPlaceholderMapUrl(m)) {
      return <img src={m} alt={label ?? "Mapa"} className={className} />;
    }
    if (m && isPlaceholderMapUrl(m)) {
      return (
        <div className={`flex items-center justify-center bg-gradient-to-br from-cream to-cream2 ${className}`}>
          <div className="flex flex-col items-center gap-2 text-muted/50">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-gold border-t-transparent" />
            <span className="text-[10px] font-medium">Cargando mapa…</span>
          </div>
        </div>
      );
    }
    return (
      <div className={`flex items-center justify-center bg-gradient-to-br from-cream to-cream2 ${className}`}>
        <div className="flex flex-col items-center gap-1.5 text-muted/40">
          <MapPin size={28} strokeWidth={1.5} />
          <span className="text-[10px] font-medium uppercase tracking-wide">Sin ubicación</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden ${className}`}>
      <div ref={containerRef} className="h-full w-full" />
      {!loaded && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-cream2">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-gold border-t-transparent" />
        </div>
      )}
    </div>
  );
}
