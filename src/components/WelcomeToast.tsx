"use client";

import { Suspense, useEffect, useRef } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { toast } from "@/lib/toast";

function WelcomeToastInner() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    if (params.get("welcome") !== "1") return;
    fired.current = true;
    toast.success("Sesión iniciada", { description: "¡Bienvenido a Unihabitat!" });
    const next = new URLSearchParams(params.toString());
    next.delete("welcome");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }, [params, router, pathname]);

  return null;
}

export function WelcomeToast() {
  return (
    <Suspense fallback={null}>
      <WelcomeToastInner />
    </Suspense>
  );
}
