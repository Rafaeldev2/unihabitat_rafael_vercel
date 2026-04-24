"use client";

import { useState } from "react";
import { Send, CheckCircle2, Phone, Mail, MapPin, Loader2 } from "lucide-react";
import { enviarContacto } from "@/app/actions/contacto";

export default function ContactoPage() {
  const [form, setForm] = useState({ nombre: "", email: "", telefono: "", asunto: "", mensaje: "" });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    const result = await enviarContacto(form);
    setSubmitting(false);
    if (result.ok) {
      setSuccess(true);
      setForm({ nombre: "", email: "", telefono: "", asunto: "", mensaje: "" });
    } else {
      setError(result.error ?? "Error desconocido");
    }
  };

  const update = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }));

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <div className="mb-10 text-center">
        <h1 className="text-2xl font-bold text-navy md:text-3xl">Contáctanos</h1>
        <p className="mx-auto mt-2 max-w-lg text-sm text-muted">
          ¿Tienes preguntas sobre nuestros activos o servicios? Rellena el formulario y te responderemos lo antes posible.
        </p>
      </div>

      <div className="grid gap-10 lg:grid-cols-[1fr_320px]">
        {/* Form */}
        <div className="rounded-xl border border-border bg-white p-6 shadow-sm md:p-8">
          {success ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <CheckCircle2 size={48} className="text-emerald-500" />
              <h2 className="text-lg font-semibold text-navy">Mensaje enviado</h2>
              <p className="text-sm text-muted">Hemos recibido tu mensaje. Te contactaremos pronto.</p>
              <button
                type="button"
                onClick={() => setSuccess(false)}
                className="mt-4 rounded-lg bg-navy px-5 py-2.5 text-xs font-medium text-white hover:bg-navy3"
              >
                Enviar otro mensaje
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-navy">
                    Nombre <span className="text-red">*</span>
                  </label>
                  <input
                    type="text" required value={form.nombre} onChange={update("nombre")}
                    placeholder="Tu nombre completo"
                    className="w-full rounded-lg border border-border bg-cream2 px-4 py-2.5 text-sm outline-none transition-all focus:border-navy focus:bg-white"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-navy">
                    Email <span className="text-red">*</span>
                  </label>
                  <input
                    type="email" required value={form.email} onChange={update("email")}
                    placeholder="tu@email.com"
                    className="w-full rounded-lg border border-border bg-cream2 px-4 py-2.5 text-sm outline-none transition-all focus:border-navy focus:bg-white"
                  />
                </div>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-navy">Teléfono</label>
                  <input
                    type="tel" value={form.telefono} onChange={update("telefono")}
                    placeholder="+34 600 000 000"
                    className="w-full rounded-lg border border-border bg-cream2 px-4 py-2.5 text-sm outline-none transition-all focus:border-navy focus:bg-white"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-navy">
                    Asunto <span className="text-red">*</span>
                  </label>
                  <select
                    required value={form.asunto} onChange={update("asunto")}
                    className="w-full cursor-pointer rounded-lg border border-border bg-cream2 px-4 py-2.5 text-sm outline-none transition-all focus:border-navy focus:bg-white"
                  >
                    <option value="">Selecciona un asunto</option>
                    <option value="Información sobre activos">Información sobre activos</option>
                    <option value="Asesoramiento NPL">Asesoramiento NPL</option>
                    <option value="Asesoramiento REO">Asesoramiento REO</option>
                    <option value="Colaboración profesional">Colaboración profesional</option>
                    <option value="Soporte técnico">Soporte técnico</option>
                    <option value="Otro">Otro</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-navy">
                  Mensaje <span className="text-red">*</span>
                </label>
                <textarea
                  required rows={5} value={form.mensaje} onChange={update("mensaje")}
                  placeholder="Escribe tu mensaje aquí..."
                  className="w-full rounded-lg border border-border bg-cream2 px-4 py-3 text-sm outline-none transition-all focus:border-navy focus:bg-white"
                />
              </div>

              <label className="flex items-start gap-2.5 text-xs text-muted">
                <input type="checkbox" required name="legal"
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-border accent-navy" />
                <span>
                  He leído y acepto el{" "}
                  <a href="#" className="font-medium text-navy underline underline-offset-2">Aviso Legal</a>{" "}
                  y la{" "}
                  <a href="#" className="font-medium text-navy underline underline-offset-2">Política de Privacidad</a>
                </span>
              </label>

              {error && (
                <div className="rounded-lg bg-red/10 px-4 py-2.5 text-xs text-red">{error}</div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="flex items-center justify-center gap-2 rounded-lg bg-navy px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-navy3 disabled:opacity-50"
              >
                {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                {submitting ? "Enviando..." : "Enviar mensaje"}
              </button>
            </form>
          )}
        </div>

        {/* Contact info sidebar */}
        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
            <h3 className="mb-4 text-sm font-semibold text-navy">Información de contacto</h3>
            <div className="flex flex-col gap-4">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gold/10 text-gold">
                  <MapPin size={16} />
                </div>
                <div>
                  <div className="text-xs font-semibold text-navy">Dirección</div>
                  <div className="text-xs text-muted">Madrid, España</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gold/10 text-gold">
                  <Phone size={16} />
                </div>
                <div>
                  <div className="text-xs font-semibold text-navy">Teléfono</div>
                  <a href="tel:+34624534931" className="text-xs text-muted hover:text-navy">624 534 931</a>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gold/10 text-gold">
                  <Mail size={16} />
                </div>
                <div>
                  <div className="text-xs font-semibold text-navy">Email</div>
                  <a href="mailto:soporte@unihabitat.com" className="text-xs text-muted hover:text-navy">soporte@unihabitat.com</a>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-gradient-to-br from-navy to-navy3 p-6">
            <h3 className="mb-2 text-sm font-semibold text-gold">Horario de atención</h3>
            <div className="flex flex-col gap-1.5 text-xs text-white/50">
              <div className="flex justify-between">
                <span>Lunes - Viernes</span>
                <span className="font-medium text-white/70">9:00 - 18:00</span>
              </div>
              <div className="flex justify-between">
                <span>Sábados</span>
                <span className="font-medium text-white/70">10:00 - 14:00</span>
              </div>
              <div className="flex justify-between">
                <span>Domingos</span>
                <span className="font-medium text-white/70">Cerrado</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
