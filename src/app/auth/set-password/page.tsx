"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  CheckCircle,
  KeyRound,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Status = "checking" | "ready" | "invalid" | "submitting" | "done";

export default function SetPasswordPage() {
  return (
    <Suspense>
      <SetPasswordForm />
    </Suspense>
  );
}

function SetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [status, setStatus] = useState<Status>("checking");
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      try {
        const code = searchParams.get("code");
        if (code) {
          const { error: exErr } = await supabase.auth.exchangeCodeForSession(code);
          if (exErr) {
            if (!cancelled) {
              setError(
                "El enlace ha caducado o ya fue usado. Pide a tu administrador que te reenvíe la invitación.",
              );
              setStatus("invalid");
            }
            return;
          }
        } else if (typeof window !== "undefined" && window.location.hash) {
          const hashParams = new URLSearchParams(
            window.location.hash.replace(/^#/, ""),
          );
          const accessToken = hashParams.get("access_token");
          const refreshToken = hashParams.get("refresh_token");
          const hashError = hashParams.get("error_description");
          if (hashError) {
            if (!cancelled) {
              setError(decodeURIComponent(hashError.replace(/\+/g, " ")));
              setStatus("invalid");
            }
            return;
          }
          if (accessToken && refreshToken) {
            const { error: setErr } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            window.history.replaceState(
              null,
              "",
              window.location.pathname + window.location.search,
            );
            if (setErr) {
              if (!cancelled) {
                setError(
                  "No se pudo activar la sesión con el enlace. Pide a tu administrador que te reenvíe la invitación.",
                );
                setStatus("invalid");
              }
              return;
            }
          }
        }

        const { data, error: sessionErr } = await supabase.auth.getUser();
        if (cancelled) return;
        if (sessionErr || !data.user) {
          setError(
            "No hemos podido validar tu enlace. Es posible que haya caducado o ya se haya usado.",
          );
          setStatus("invalid");
          return;
        }
        setEmail(data.user.email ?? "");
        setStatus("ready");
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Error inesperado al validar el enlace.");
        setStatus("invalid");
      }
    }

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, [searchParams, supabase]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setStatus("submitting");
    try {
      const { error: updErr } = await supabase.auth.updateUser({ password });
      if (updErr) {
        setError(updErr.message || "No se pudo actualizar la contraseña.");
        setStatus("ready");
        return;
      }
      setStatus("done");
      setTimeout(() => router.replace("/admin"), 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado.");
      setStatus("ready");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-navy via-navy2 to-navy3 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center">
            <img src="/LogoAzul.svg" alt="Unihabitat" className="h-12 w-auto" />
          </div>
          <h1 className="text-2xl font-bold text-white">Define tu contraseña</h1>
          <p className="mt-1 text-sm text-white/50">
            Acceso de agente · Unihabitat
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-8 backdrop-blur-md">
          {status === "checking" && (
            <div className="flex flex-col items-center gap-3 py-6 text-white/70">
              <Loader2 size={24} className="animate-spin text-gold" />
              <p className="text-sm">Validando enlace seguro…</p>
            </div>
          )}

          {status === "invalid" && (
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/15">
                <AlertCircle size={22} className="text-red-300" />
              </div>
              <div>
                <p className="text-base font-semibold text-white">
                  Enlace no válido
                </p>
                <p className="mt-2 text-sm text-white/60">{error}</p>
              </div>
              <Link
                href="/login"
                className="mt-2 rounded-lg bg-white/10 px-4 py-2 text-xs font-medium text-white hover:bg-white/15"
              >
                Volver al login
              </Link>
            </div>
          )}

          {status === "done" && (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15">
                <CheckCircle size={22} className="text-emerald-300" />
              </div>
              <p className="text-base font-semibold text-white">
                Contraseña actualizada
              </p>
              <p className="text-sm text-white/60">
                Te llevamos al panel de administración…
              </p>
            </div>
          )}

          {(status === "ready" || status === "submitting") && (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="rounded-lg border border-gold/20 bg-gold/5 px-3 py-2 text-xs text-gold">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={14} />
                  <span>
                    Estás definiendo la contraseña para <strong>{email}</strong>
                  </span>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-white/60">
                  Nueva contraseña
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  className="w-full rounded-lg border border-white/10 bg-white/[0.06] px-3.5 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-gold/50 focus:outline-none focus:ring-1 focus:ring-gold/30"
                  placeholder="Mínimo 8 caracteres"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-white/60">
                  Confirmar contraseña
                </label>
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  className="w-full rounded-lg border border-white/10 bg-white/[0.06] px-3.5 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-gold/50 focus:outline-none focus:ring-1 focus:ring-gold/30"
                  placeholder="Repite la contraseña"
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-300">
                  <AlertCircle size={14} /> {error}
                </div>
              )}

              <button
                type="submit"
                disabled={status === "submitting"}
                className="flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-gold to-gold3 py-2.5 text-sm font-semibold text-navy shadow-md transition-all hover:shadow-lg disabled:opacity-50"
              >
                {status === "submitting" ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <KeyRound size={14} />
                )}
                {status === "submitting" ? "Guardando…" : "Guardar y entrar"}
              </button>
            </form>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-white/30">
          Unihabitat v2.0 — Acceso para agentes
        </p>
      </div>
    </div>
  );
}
