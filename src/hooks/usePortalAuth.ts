"use client";

import { useState, useEffect } from "react";
import { getDevAuthFromDocument } from "@/lib/dev-auth-client";
import { createClient } from "@/lib/supabase/client";

export type PortalAuthState = {
  /** true cuando hay sesión (cookie dev-auth o Supabase): datos reservados del portal. */
  sensitiveVisible: boolean;
  currentUser: { email: string; nombre: string } | null;
  userResolved: boolean;
};

export function usePortalAuth(): PortalAuthState {
  const [portalAuthChecked, setPortalAuthChecked] = useState(false);
  const [portalLoggedIn, setPortalLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ email: string; nombre: string } | null>(null);
  const [userResolved, setUserResolved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const dev = getDevAuthFromDocument();
      if (dev) {
        if (!cancelled) {
          setPortalLoggedIn(true);
          setPortalAuthChecked(true);
          if (dev.role === "cliente") {
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
          const role = (user.user_metadata?.role as string | undefined) ?? "cliente";
          if (role === "cliente" && user.email) {
            setCurrentUser({
              email: user.email,
              nombre: (user.user_metadata?.nombre as string | undefined) || "Usuario",
            });
          } else {
            setCurrentUser(null);
          }
        } else {
          setCurrentUser(null);
        }
      } catch {
        if (!cancelled) {
          setPortalLoggedIn(false);
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
    currentUser,
    userResolved,
  };
}
