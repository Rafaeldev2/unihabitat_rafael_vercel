"use client";

import { useState, useEffect } from "react";
import { getDevAuthFromDocument } from "@/lib/dev-auth-client";
import { createClient } from "@/lib/supabase/client";

export type PortalRole = "admin" | "vendedor" | "cliente" | null;

export type PortalAuthState = {
  /** true cuando hay sesión (cookie dev-auth o Supabase): datos reservados del portal. */
  sensitiveVisible: boolean;
  /** true solo para personal interno (admin / vendedor). Datos privados del activo. */
  isStaff: boolean;
  role: PortalRole;
  currentUser: { email: string; nombre: string } | null;
  userResolved: boolean;
};

function normalizeRole(raw: string | undefined | null): PortalRole {
  if (raw === "admin" || raw === "vendedor" || raw === "cliente") return raw;
  return null;
}

export function usePortalAuth(): PortalAuthState {
  const [portalAuthChecked, setPortalAuthChecked] = useState(false);
  const [portalLoggedIn, setPortalLoggedIn] = useState(false);
  const [role, setRole] = useState<PortalRole>(null);
  const [currentUser, setCurrentUser] = useState<{ email: string; nombre: string } | null>(null);
  const [userResolved, setUserResolved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const dev = getDevAuthFromDocument();
      if (dev) {
        if (!cancelled) {
          const devRole = normalizeRole(dev.role);
          setPortalLoggedIn(true);
          setPortalAuthChecked(true);
          setRole(devRole);
          if (devRole === "cliente") {
            setCurrentUser({ email: dev.email, nombre: dev.nombre });
          } else {
            setCurrentUser(null);
          }
          setUserResolved(true);
        }
        return;
      }
      try {
        const sb = createClient();
        const { data: { user } } = await sb.auth.getUser();
        if (cancelled) return;
        setPortalLoggedIn(Boolean(user));
        if (user) {
          const userRole = normalizeRole(user.user_metadata?.role as string | undefined) ?? "cliente";
          setRole(userRole);
          if (userRole === "cliente" && user.email) {
            setCurrentUser({
              email: user.email,
              nombre: (user.user_metadata?.nombre as string | undefined) || "Usuario",
            });
          } else {
            setCurrentUser(null);
          }
        } else {
          setRole(null);
          setCurrentUser(null);
        }
      } catch {
        if (!cancelled) {
          setPortalLoggedIn(false);
          setRole(null);
          setCurrentUser(null);
        }
      } finally {
        if (!cancelled) {
          setPortalAuthChecked(true);
          setUserResolved(true);
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return {
    sensitiveVisible: portalAuthChecked && portalLoggedIn,
    isStaff: portalAuthChecked && (role === "admin" || role === "vendedor"),
    role,
    currentUser,
    userResolved,
  };
}
