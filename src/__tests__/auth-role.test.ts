import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { isDevAuthEnabled, resolveRole, isDemoEmail } from "@/lib/auth-role";

describe("auth-role", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("isDevAuthEnabled", () => {
    it("returns true in development", () => {
      process.env.NODE_ENV = "development";
      delete process.env.ALLOW_DEV_AUTH;
      expect(isDevAuthEnabled()).toBe(true);
    });

    it("returns false in production by default", () => {
      process.env.NODE_ENV = "production";
      delete process.env.ALLOW_DEV_AUTH;
      expect(isDevAuthEnabled()).toBe(false);
    });

    it("returns true in production if ALLOW_DEV_AUTH is set", () => {
      process.env.NODE_ENV = "production";
      process.env.ALLOW_DEV_AUTH = "true";
      expect(isDevAuthEnabled()).toBe(true);
    });

    it("returns true in test mode", () => {
      process.env.NODE_ENV = "test";
      delete process.env.ALLOW_DEV_AUTH;
      expect(isDevAuthEnabled()).toBe(true);
    });
  });

  describe("resolveRole", () => {
    it("returns admin if metadata role is admin", () => {
      expect(resolveRole("admin", "user@example.com")).toBe("admin");
    });

    it("returns vendedor if metadata role is vendedor", () => {
      expect(resolveRole("vendedor", "user@example.com")).toBe("vendedor");
    });

    it("returns admin for @unihabitat.net email without metadata role", () => {
      expect(resolveRole(undefined, "john@unihabitat.net")).toBe("admin");
      expect(resolveRole(null, "JANE@UNIHABITAT.NET")).toBe("admin");
      expect(resolveRole("", "test@unihabitat.net")).toBe("admin");
    });

    it("returns admin for @unihabitat.com email without metadata role", () => {
      expect(resolveRole(undefined, "modesto.manzano@unihabitat.com")).toBe(
        "admin",
      );
      expect(resolveRole(null, "USER@UNIHABITAT.COM")).toBe("admin");
    });

    it("returns cliente for other emails without metadata role", () => {
      expect(resolveRole(undefined, "user@gmail.com")).toBe("cliente");
      expect(resolveRole(null, "test@propcrm.com")).toBe("cliente");
    });

    it("returns cliente when no metadata and no email", () => {
      expect(resolveRole(undefined, undefined)).toBe("cliente");
      expect(resolveRole(null, null)).toBe("cliente");
    });

    it("prefers metadata role over email domain", () => {
      expect(resolveRole("vendedor", "admin@unihabitat.net")).toBe("vendedor");
    });

    it("handles case-insensitive roles", () => {
      expect(resolveRole("ADMIN", "user@test.com")).toBe("admin");
      expect(resolveRole("Vendedor", "user@test.com")).toBe("vendedor");
    });

    it("ignores invalid roles and falls back to email domain", () => {
      expect(resolveRole("superuser", "user@unihabitat.net")).toBe("admin");
      expect(resolveRole("manager", "user@gmail.com")).toBe("cliente");
    });
  });

  describe("isDemoEmail", () => {
    it("returns true for @propcrm.com emails", () => {
      expect(isDemoEmail("admin@propcrm.com")).toBe(true);
      expect(isDemoEmail("CLIENTE@PROPCRM.COM")).toBe(true);
      expect(isDemoEmail("vendedor@propcrm.com")).toBe(true);
    });

    it("returns false for other emails", () => {
      expect(isDemoEmail("admin@unihabitat.net")).toBe(false);
      expect(isDemoEmail("user@gmail.com")).toBe(false);
      expect(isDemoEmail("propcrm@gmail.com")).toBe(false);
    });

    it("returns false for null/undefined", () => {
      expect(isDemoEmail(null)).toBe(false);
      expect(isDemoEmail(undefined)).toBe(false);
    });
  });
});
