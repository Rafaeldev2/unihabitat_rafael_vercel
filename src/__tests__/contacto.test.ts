import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/email/send", () => ({
  sendEmail: vi.fn(async () => ({ ok: true })),
}));

vi.mock("@/lib/email/templates", () => ({
  contactInquiryTemplate: vi.fn(() => ({
    subject: "Contacto",
    html: "<p>test</p>",
    text: "test",
  })),
}));

vi.mock("@/lib/email/resend", () => ({
  EMAIL_SUPPORT: "support@test.com",
}));

describe("enviarContacto", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("rejects honeypot-filled submissions silently", async () => {
    const { enviarContacto } = await import("@/app/actions/contacto");
    const { sendEmail } = await import("@/lib/email/send");

    const result = await enviarContacto({
      nombre: "Test",
      email: "test@example.com",
      asunto: "Test",
      mensaje: "Hello",
      honeypot: "bot-filled-value",
    });

    expect(result.ok).toBe(true);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("rejects submissions too fast silently", async () => {
    const { enviarContacto } = await import("@/app/actions/contacto");
    const { sendEmail } = await import("@/lib/email/send");

    const result = await enviarContacto({
      nombre: "Test",
      email: "test@example.com",
      asunto: "Test",
      mensaje: "Hello",
      formTimestamp: Date.now() - 500,
    });

    expect(result.ok).toBe(true);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("allows submissions after minimum time", async () => {
    const { enviarContacto } = await import("@/app/actions/contacto");
    const { sendEmail } = await import("@/lib/email/send");

    const result = await enviarContacto({
      nombre: "Test User",
      email: "test@example.com",
      asunto: "Test Subject",
      mensaje: "Hello World",
      formTimestamp: Date.now() - 3000,
    });

    expect(result.ok).toBe(true);
    expect(sendEmail).toHaveBeenCalled();
  });

  it("rejects missing required fields", async () => {
    const { enviarContacto } = await import("@/app/actions/contacto");

    const result = await enviarContacto({
      nombre: "",
      email: "test@example.com",
      asunto: "Test",
      mensaje: "Hello",
    });

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/obligatorios/);
  });

  it("rate limits repeated submissions from same email", async () => {
    vi.resetModules();
    const { enviarContacto } = await import("@/app/actions/contacto");

    for (let i = 0; i < 5; i++) {
      const result = await enviarContacto({
        nombre: "Test",
        email: "ratelimit@example.com",
        asunto: "Test",
        mensaje: "Hello",
        formTimestamp: Date.now() - 3000,
      });
      expect(result.ok).toBe(true);
    }

    const rateLimited = await enviarContacto({
      nombre: "Test",
      email: "ratelimit@example.com",
      asunto: "Test",
      mensaje: "Hello",
      formTimestamp: Date.now() - 3000,
    });

    expect(rateLimited.ok).toBe(false);
    expect(rateLimited.error).toMatch(/demasiados mensajes/i);
  });

  it("empty honeypot is allowed", async () => {
    const { enviarContacto } = await import("@/app/actions/contacto");
    const { sendEmail } = await import("@/lib/email/send");

    const result = await enviarContacto({
      nombre: "Test",
      email: "empty-honeypot@example.com",
      asunto: "Test",
      mensaje: "Hello",
      honeypot: "",
      formTimestamp: Date.now() - 3000,
    });

    expect(result.ok).toBe(true);
    expect(sendEmail).toHaveBeenCalled();
  });
});
