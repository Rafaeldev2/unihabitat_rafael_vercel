"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { fetchFavoritosByComprador, addFavorito, removeFavorito } from "@/app/actions/favoritos";

export interface UseFavoritosResult {
  favoritos: Set<string>;
  isFavorito: (assetId: string) => boolean;
  toggleFavorito: (assetId: string) => Promise<void>;
  loading: boolean;
}

export function useFavoritos(compradorId: string | null): UseFavoritosResult {
  const [favoritos, setFavoritos] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const inflightRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!compradorId) {
      setFavoritos(new Set());
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchFavoritosByComprador(compradorId)
      .then((ids) => {
        if (!cancelled) setFavoritos(new Set(ids));
      })
      .catch(() => {
        if (!cancelled) setFavoritos(new Set());
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [compradorId]);

  const isFavorito = useCallback((assetId: string) => favoritos.has(assetId), [favoritos]);

  const toggleFavorito = useCallback(async (assetId: string) => {
    if (!compradorId || inflightRef.current.has(assetId)) return;
    inflightRef.current.add(assetId);

    const wasFav = favoritos.has(assetId);
    setFavoritos((prev) => {
      const next = new Set(prev);
      if (wasFav) next.delete(assetId);
      else next.add(assetId);
      return next;
    });

    try {
      const result = wasFav
        ? await removeFavorito(compradorId, assetId)
        : await addFavorito(compradorId, assetId);
      if (!result.success) {
        setFavoritos((prev) => {
          const next = new Set(prev);
          if (wasFav) next.add(assetId);
          else next.delete(assetId);
          return next;
        });
      }
    } catch {
      setFavoritos((prev) => {
        const next = new Set(prev);
        if (wasFav) next.add(assetId);
        else next.delete(assetId);
        return next;
      });
    } finally {
      inflightRef.current.delete(assetId);
    }
  }, [compradorId, favoritos]);

  return { favoritos, isFavorito, toggleFavorito, loading };
}
