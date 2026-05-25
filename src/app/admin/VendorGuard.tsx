"use client";

import { useEffect, useState, type ReactNode } from "react";
import { fetchCurrentSession } from "@/app/actions/session";
import { fetchVendorPermissions } from "@/app/actions/permissions";
import { canViewSection } from "@/lib/auth-helpers";
import type { VendorPermission, SectionId, UserSession } from "@/lib/permissions";
import { ShieldOff } from "lucide-react";
import Link from "next/link";

interface VendorGuardProps {
  sectionId: SectionId;
  children: ReactNode;
}

export function VendorGuard({ sectionId, children }: VendorGuardProps) {
  const [state, setState] = useState<"loading" | "allowed" | "denied">("loading");

  useEffect(() => {
    let cancelled = false;

    fetchCurrentSession()
      .then(async (s: UserSession | null) => {
        if (cancelled) return;
        if (!s) { setState("denied"); return; }
        if (s.role === "admin") { setState("allowed"); return; }
        if (s.role !== "vendedor" || !s.vendedorId) { setState("denied"); return; }

        const perms: VendorPermission[] = await fetchVendorPermissions(s.vendedorId);
        if (cancelled) return;
        setState(canViewSection(s, sectionId, perms) ? "allowed" : "denied");
      })
      .catch(() => {
        if (!cancelled) setState("denied");
      });

    return () => {
      cancelled = true;
    };
  }, [sectionId]);

  if (state === "loading") return null;
  if (state === "denied") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-muted">
        <ShieldOff size={48} strokeWidth={1} className="text-border" />
        <p className="text-lg font-medium text-navy">Sin acceso</p>
        <p className="text-sm">No tienes permisos para ver esta sección.</p>
        <Link href="/admin" className="rounded-lg bg-navy px-4 py-2 text-sm font-medium text-white hover:bg-navy3">
          Volver al inicio
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}
