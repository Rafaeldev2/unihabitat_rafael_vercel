"use client";

import { useEffect, useState, type ReactNode } from "react";
import { getDevAuthFromDocument } from "@/lib/auth-helpers";
import { fetchVendorPermissions } from "@/app/actions/permissions";
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
    const s = getDevAuthFromDocument() as UserSession | null;
    if (!s) { setState("denied"); return; }
    if (s.role === "admin") { setState("allowed"); return; }
    if (s.role !== "vendedor" || !s.vendedorId) { setState("denied"); return; }

    fetchVendorPermissions(s.vendedorId)
      .then((perms: VendorPermission[]) => {
        const perm = perms.find((p) => p.section === sectionId);
        setState(perm?.canView ? "allowed" : "denied");
      })
      .catch(() => setState("denied"));
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
