"use client";

import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import type { Asset, Comprador, Vendedor, Tarea } from "./types";
import type { VendorPermission, UserSession } from "./permissions";
// `assets` de mock-data ya NO se usa como semilla inicial; lo dejamos
// disponible por si en el futuro se añade una acción "Sembrar demo".
import { compradores as initialComp, vendedores as initialVend, tareasData } from "./mock-data";
import { fetchAssets } from "@/app/actions/assets";
import { backfillMissingMaps } from "@/app/actions/maps";
import { shouldBackfillMapFromAddress } from "@/lib/map-default";
import { getDevAuthFromDocument } from "@/lib/auth-helpers";
import { fetchVendorPermissions, fetchVendorAssignedAssetIds, fetchVendorAssignedCompradorIds } from "@/app/actions/permissions";

interface AppState {
  assets: Asset[];
  compradores: Comprador[];
  vendedores: Vendedor[];
  tareas: Tarea[];
  assetsLoading: boolean;
  assetsError: string | null;
}

interface AppContextType extends AppState {
  session: UserSession | null;
  permissions: VendorPermission[];
  assignedAssetIds: string[];
  assignedCompradorIds: string[];
  togglePub: (id: string) => void;
  toggleFav: (id: string) => void;
  toggleChk: (id: string) => void;
  toggleChkAll: (ids: string[]) => void;
  toggleTaskDone: (id: string) => void;
  addAssets: (assets: Asset[]) => void;
  clearAssets: () => void;
  removeAssetsByIds: (ids: string[]) => void;
  getAsset: (id: string) => Asset | undefined;
  getComprador: (id: string) => Comprador | undefined;
  getVendedor: (id: string) => Vendedor | undefined;
  refreshAssignments: () => Promise<void>;
  /** Recarga activos desde Supabase y aplica geocodificación en lotes (tras import / evento). */
  refreshAssets: () => Promise<void>;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  // Inicializamos `assets` vacío para que la lista nunca arranque con los 6
  // mocks de `mock-data.ts`. Los datos reales llegan de Supabase vía
  // `loadAssetsFromServer()` y se exponen `assetsLoading` / `assetsError`
  // para que la UI distinga "cargando" de "error" en lugar de mostrar mocks
  // engañosos. Compradores, vendedores y tareas conservan su semilla mientras
  // no estén dentro del alcance de esta corrección.
  const [state, setState] = useState<AppState>({
    assets: [],
    compradores: initialComp,
    vendedores: initialVend,
    tareas: tareasData,
    assetsLoading: true,
    assetsError: null,
  });

  const [session, setSession] = useState<UserSession | null>(null);
  const [permissions, setPermissions] = useState<VendorPermission[]>([]);
  const [assignedAssetIds, setAssignedAssetIds] = useState<string[]>([]);
  const [assignedCompradorIds, setAssignedCompradorIds] = useState<string[]>([]);
  const pathname = usePathname();

  const assetsLoadTokenRef = useRef(0);
  const BACKFILL_CHUNK = 100;

  const loadAssetsFromServer = useCallback(async () => {
    const token = ++assetsLoadTokenRef.current;
    setState((prev) => ({ ...prev, assetsLoading: true, assetsError: null }));
    try {
      let rows = await fetchAssets();
      if (token !== assetsLoadTokenRef.current) return;

      // Antes existía un early-return cuando rows.length === 0 que dejaba los
      // mocks visibles. Eso enmascaraba fallos reales del fetch (BD vacía vs
      // BD inalcanzable se veían igual). Ahora siempre escribimos el resultado.
      // Backfill defensivo: solo para filas SIN coordenadas y con dirección
      // utilizable. La importación inicial ya geocodifica server-side, así
      // que aquí solo recuperamos casos antiguos o errores transitorios.
      const GEOAPIFY_KEY = process.env.NEXT_PUBLIC_GEOAPIFY_KEY;
      if (GEOAPIFY_KEY && rows.length > 0) {
        const needMap = rows.filter(
          (a) => a.lat == null && a.lng == null && shouldBackfillMapFromAddress(a),
        );
        for (let i = 0; i < needMap.length; i += BACKFILL_CHUNK) {
          if (token !== assetsLoadTokenRef.current) return;
          const chunk = needMap.slice(i, i + BACKFILL_CHUNK);
          const stubs = chunk.map((a) => ({
            id: a.id,
            addr: a.addr,
            pob: a.pob,
            prov: a.prov,
            cp: a.cp,
          }));
          try {
            const { hits } = await backfillMissingMaps(stubs);
            rows = rows.map((a) => {
              const h = hits[a.id];
              if (!h) return a;
              return { ...a, map: h.map, lat: h.lat, lng: h.lng };
            });
          } catch {
            /* chunk sin backfill */
          }
        }
      }

      if (token !== assetsLoadTokenRef.current) return;
      setState((prev) => ({ ...prev, assets: rows, assetsLoading: false, assetsError: null }));
    } catch (err) {
      // Si la BD falla, NO mantenemos los mocks: es engañoso. Vaciamos la
      // lista, registramos el error y lo exponemos al UI vía `assetsError`.
      console.error("[loadAssetsFromServer] fetchAssets falló:", err);
      if (token === assetsLoadTokenRef.current) {
        const msg = err instanceof Error ? err.message : "No se pudieron cargar los activos";
        setState((prev) => ({ ...prev, assets: [], assetsLoading: false, assetsError: msg }));
      }
    }
  }, []);

  const refreshAssets = useCallback(() => loadAssetsFromServer(), [loadAssetsFromServer]);

  useEffect(() => {
    // Re-read the dev-auth cookie on every navigation so that signing out and
    // logging in under a different role (admin ↔ vendedor) refreshes the
    // session immediately. AppProvider lives in the root layout and never
    // remounts, so a one-shot mount effect would leave `session` stuck at
    // whatever it was on first page load.
    setSession(getDevAuthFromDocument());
  }, [pathname]);

  useEffect(() => {
    void loadAssetsFromServer();
  }, [loadAssetsFromServer]);

  useEffect(() => {
    const onAssetsUpdated = () => {
      void loadAssetsFromServer();
    };
    window.addEventListener("propcrm-assets-updated", onAssetsUpdated);
    return () => window.removeEventListener("propcrm-assets-updated", onAssetsUpdated);
  }, [loadAssetsFromServer]);


  useEffect(() => {
    if (!session) return;
    if (session.role !== "vendedor" || !session.vendedorId) return;
    let cancelled = false;
    const vid = session.vendedorId;
    fetchVendorPermissions(vid).then((p) => !cancelled && setPermissions(p)).catch(() => {});
    fetchVendorAssignedAssetIds(vid).then((ids) => !cancelled && setAssignedAssetIds(ids)).catch(() => {});
    fetchVendorAssignedCompradorIds(vid).then((ids) => !cancelled && setAssignedCompradorIds(ids)).catch(() => {});
    return () => { cancelled = true; };
  }, [session]);

  const refreshAssignments = useCallback(async () => {
    if (session?.role === "vendedor" && session.vendedorId) {
      const [aIds, cIds] = await Promise.all([
        fetchVendorAssignedAssetIds(session.vendedorId),
        fetchVendorAssignedCompradorIds(session.vendedorId),
      ]);
      setAssignedAssetIds(aIds);
      setAssignedCompradorIds(cIds);
    }
  }, [session]);

  // Vendedor and admin see the same asset list. Per-vendedor restriction was
  // dropped intentionally — the only role-based hiding for vendedores happens
  // at the asset-detail tab level (Agentes / Clientes / Administrador).
  const filteredAssets = state.assets;

  const filteredCompradores = session?.role === "vendedor" && assignedCompradorIds.length > 0
    ? state.compradores.filter((c) => assignedCompradorIds.includes(c.id))
    : session?.role === "vendedor"
      ? []
      : state.compradores;

  const filteredTareas = session?.role === "vendedor"
    ? state.tareas.filter((t) => t.agente === session.nombre)
    : state.tareas;

  const togglePub = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      assets: prev.assets.map(a => a.id === id ? { ...a, pub: !a.pub, fase: !a.pub ? "Publicado" : "Suspendido", faseC: !a.pub ? "fp-pub" : "fp-sus" } : a),
    }));
  }, []);

  const toggleFav = useCallback((id: string) => {
    setState(prev => ({ ...prev, assets: prev.assets.map(a => a.id === id ? { ...a, fav: !a.fav } : a) }));
  }, []);

  const toggleChk = useCallback((id: string) => {
    setState(prev => ({ ...prev, assets: prev.assets.map(a => a.id === id ? { ...a, chk: !a.chk } : a) }));
  }, []);

  const toggleChkAll = useCallback((ids: string[]) => {
    setState(prev => {
      const allChecked = ids.every(id => prev.assets.find(a => a.id === id)?.chk);
      return { ...prev, assets: prev.assets.map(a => ids.includes(a.id) ? { ...a, chk: !allChecked } : a) };
    });
  }, []);

  const toggleTaskDone = useCallback((id: string) => {
    setState(prev => ({ ...prev, tareas: prev.tareas.map(t => t.id === id ? { ...t, done: !t.done } : t) }));
  }, []);

  const addAssets = useCallback((assets: Asset[]) => {
    if (assets.length === 0) return;
    setState(prev => {
      const indexById = new Map(prev.assets.map((a, i) => [a.id, i]));
      const next = [...prev.assets];
      for (const a of assets) {
        const i = indexById.get(a.id);
        if (i !== undefined) next[i] = a;
        else { next.push(a); indexById.set(a.id, next.length - 1); }
      }
      return { ...prev, assets: next };
    });
  }, []);

  const clearAssets = useCallback(() => {
    setState(prev => ({ ...prev, assets: [] }));
  }, []);

  const removeAssetsByIds = useCallback((ids: string[]) => {
    if (ids.length === 0) return;
    const drop = new Set(ids);
    setState(prev => ({ ...prev, assets: prev.assets.filter(a => !drop.has(a.id)) }));
  }, []);

  const getAsset = useCallback((id: string) => state.assets.find(a => a.id === id), [state.assets]);
  const getComprador = useCallback((id: string) => state.compradores.find(c => c.id === id), [state.compradores]);
  const getVendedor = useCallback((id: string) => state.vendedores.find(v => v.id === id), [state.vendedores]);

  return (
    <AppContext.Provider value={{
      assets: filteredAssets,
      compradores: filteredCompradores,
      vendedores: state.vendedores,
      tareas: filteredTareas,
      assetsLoading: state.assetsLoading,
      assetsError: state.assetsError,
      session,
      permissions,
      assignedAssetIds,
      assignedCompradorIds,
      togglePub, toggleFav, toggleChk, toggleChkAll, toggleTaskDone,
      addAssets, clearAssets, removeAssetsByIds, getAsset, getComprador, getVendedor,
      refreshAssignments, refreshAssets,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
