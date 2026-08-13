"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { requestPasswordReset, updatePassword } from "../actions";
import { Mail, Lock, AlertCircle, CheckCircle2, ArrowLeft, Loader2 } from "lucide-react";

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const hasRecoveryToken =
    searchParams.has("token_hash") ||
    searchParams.has("type") ||
    searchParams.has("access_token");

  const [mode, setMode] = useState<"request" | "update">(
    hasRecoveryToken ? "update" : "request"
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (hasRecoveryToken) {
      setMode("update");
    }
  }, [hasRecoveryToken]);

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const fd = new FormData();
    fd.set("email", email);

    const result = await requestPasswordReset(fd);
    setLoading(false);

    if (result.error) {
      setError(result.error);
    } else {
      setSuccess(true);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const fd = new FormData();
    fd.set("password", password);
    fd.set("confirmPassword", confirmPassword);

    const result = await updatePassword(fd);
    setLoading(false);

    if (result.error) {
      setError(result.error);
    } else {
      setSuccess(true);
      setTimeout(() => {
        router.push("/login");
      }, 2000);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-navy via-navy2 to-navy3 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex justify-center">
            <span className="inline-flex items-center gap-2.5">
              <img src="/LogoAzul.svg" alt="" className="h-12 w-auto" />
              <h1 className="text-2xl font-bold text-white">
                Unihabitat<span className="text-black">*</span>
              </h1>
            </span>
          </div>
          <p className="mt-1 text-sm text-white/50">
            {mode === "request" ? "Recuperar contraseña" : "Nueva contraseña"}
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-8 backdrop-blur-md">
          {success ? (
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <CheckCircle2 size={48} className="text-green-400" />
              {mode === "request" ? (
                <>
                  <h2 className="text-lg font-semibold text-white">Email enviado</h2>
                  <p className="text-sm text-white/60">
                    Si existe una cuenta con ese email, recibirás instrucciones para
                    restablecer tu contraseña.
                  </p>
                </>
              ) : (
                <>
                  <h2 className="text-lg font-semibold text-white">Contraseña actualizada</h2>
                  <p className="text-sm text-white/60">
                    Tu contraseña ha sido cambiada. Redirigiendo al login...
                  </p>
                </>
              )}
              <Link
                href="/login"
                className="mt-2 flex items-center gap-2 text-sm text-gold hover:underline"
              >
                <ArrowLeft size={14} /> Volver al login
              </Link>
            </div>
          ) : mode === "request" ? (
            <form onSubmit={handleRequestReset} className="flex flex-col gap-5">
              <div className="mb-2 flex items-center justify-center gap-2 text-white/60">
                <Mail size={20} />
                <span className="text-sm">Introduce tu email</span>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-white/60">
                  Email
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-white/[0.06] px-3.5 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-gold/50 focus:outline-none focus:ring-1 focus:ring-gold/30"
                  placeholder="tu@email.com"
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-300">
                  <AlertCircle size={14} /> {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-gradient-to-r from-gold to-gold3 py-2.5 text-sm font-semibold text-navy shadow-md transition-all hover:shadow-lg disabled:opacity-50"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 size={16} className="animate-spin" /> Enviando...
                  </span>
                ) : (
                  "Enviar email de recuperación"
                )}
              </button>

              <Link
                href="/login"
                className="mt-2 flex items-center justify-center gap-2 text-sm text-white/50 hover:text-white/70"
              >
                <ArrowLeft size={14} /> Volver al login
              </Link>
            </form>
          ) : (
            <form onSubmit={handleUpdatePassword} className="flex flex-col gap-5">
              <div className="mb-2 flex items-center justify-center gap-2 text-white/60">
                <Lock size={20} />
                <span className="text-sm">Introduce tu nueva contraseña</span>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-white/60">
                  Nueva contraseña
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-white/[0.06] px-3.5 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-gold/50 focus:outline-none focus:ring-1 focus:ring-gold/30"
                  placeholder="Mínimo 6 caracteres"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-white/60">
                  Confirmar contraseña
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
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
                disabled={loading}
                className="w-full rounded-lg bg-gradient-to-r from-gold to-gold3 py-2.5 text-sm font-semibold text-navy shadow-md transition-all hover:shadow-lg disabled:opacity-50"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 size={16} className="animate-spin" /> Actualizando...
                  </span>
                ) : (
                  "Actualizar contraseña"
                )}
              </button>
            </form>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-white/30">
          Unihabitat v2.0 — Panel de gestión inmobiliaria
        </p>
      </div>
    </div>
  );
}
