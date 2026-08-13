import { describe, it, expect } from "vitest";
import { isStagingGuideEnabled } from "@/lib/staging-guide";

describe("isStagingGuideEnabled", () => {
  const testEnv = (overrides: Partial<NodeJS.ProcessEnv> = {}): NodeJS.ProcessEnv => ({
    NODE_ENV: "development",
    ...overrides,
  } as NodeJS.ProcessEnv);

  describe("production hosts always return false", () => {
    it("www.unihabitat.net returns false even with flag true", () => {
      const env = testEnv({ NEXT_PUBLIC_SHOW_STAGING_GUIDE: "true" });
      expect(isStagingGuideEnabled("www.unihabitat.net", env)).toBe(false);
    });

    it("unihabitat.net returns false even with flag true", () => {
      const env = testEnv({ NEXT_PUBLIC_SHOW_STAGING_GUIDE: "true" });
      expect(isStagingGuideEnabled("unihabitat.net", env)).toBe(false);
    });

    it("production hosts are case-insensitive", () => {
      const env = testEnv({ NEXT_PUBLIC_SHOW_STAGING_GUIDE: "true" });
      expect(isStagingGuideEnabled("WWW.UNIHABITAT.NET", env)).toBe(false);
      expect(isStagingGuideEnabled("Unihabitat.Net", env)).toBe(false);
    });
  });

  describe("flag behavior", () => {
    it("flag='false' returns false regardless of hostname", () => {
      const env = testEnv({ NEXT_PUBLIC_SHOW_STAGING_GUIDE: "false" });
      expect(isStagingGuideEnabled("localhost", env)).toBe(false);
      expect(isStagingGuideEnabled("unihabitat-staging.vercel.app", env)).toBe(false);
    });

    it("flag='true' returns true on non-prod hosts", () => {
      const env = testEnv({ NEXT_PUBLIC_SHOW_STAGING_GUIDE: "true" });
      expect(isStagingGuideEnabled("localhost", env)).toBe(true);
      expect(isStagingGuideEnabled("example.com", env)).toBe(true);
    });
  });

  describe("automatic enabling without flag", () => {
    it("localhost returns true", () => {
      const env = testEnv({});
      expect(isStagingGuideEnabled("localhost", env)).toBe(true);
    });

    it("127.0.0.1 returns true", () => {
      const env = testEnv({});
      expect(isStagingGuideEnabled("127.0.0.1", env)).toBe(true);
    });

    it("hostname containing 'unihabitat-staging' returns true", () => {
      const env = testEnv({});
      expect(isStagingGuideEnabled("unihabitat-staging.vercel.app", env)).toBe(true);
      expect(isStagingGuideEnabled("pr-123-unihabitat-staging.vercel.app", env)).toBe(true);
    });

    it("VERCEL_ENV='preview' returns true", () => {
      const env = testEnv({ VERCEL_ENV: "preview" });
      expect(isStagingGuideEnabled("random-preview-url.vercel.app", env)).toBe(true);
    });

    it("NODE_ENV !== 'production' returns true", () => {
      const env = testEnv({ NODE_ENV: "development" });
      expect(isStagingGuideEnabled("some-random-host.com", env)).toBe(true);

      const testEnvNode = testEnv({ NODE_ENV: "test" });
      expect(isStagingGuideEnabled("some-random-host.com", testEnvNode)).toBe(true);
    });

    it("production NODE_ENV without other triggers returns false", () => {
      const env = testEnv({ NODE_ENV: "production" });
      expect(isStagingGuideEnabled("some-random-host.com", env)).toBe(false);
    });
  });

  describe("priority order", () => {
    it("production host takes priority over all other conditions", () => {
      const env = testEnv({
        NEXT_PUBLIC_SHOW_STAGING_GUIDE: "true",
        VERCEL_ENV: "preview",
        NODE_ENV: "development",
      });
      expect(isStagingGuideEnabled("www.unihabitat.net", env)).toBe(false);
    });

    it("flag='false' takes priority over hostname patterns", () => {
      const env = testEnv({ NEXT_PUBLIC_SHOW_STAGING_GUIDE: "false" });
      expect(isStagingGuideEnabled("localhost", env)).toBe(false);
      expect(isStagingGuideEnabled("unihabitat-staging.vercel.app", env)).toBe(false);
    });

    it("flag='true' enables on any non-prod host", () => {
      const env = testEnv({
        NEXT_PUBLIC_SHOW_STAGING_GUIDE: "true",
        NODE_ENV: "production",
      });
      expect(isStagingGuideEnabled("random-domain.com", env)).toBe(true);
    });
  });

  describe("edge cases", () => {
    it("handles null hostname gracefully", () => {
      const env = testEnv({ NODE_ENV: "development" });
      expect(isStagingGuideEnabled(null, env)).toBe(true);
    });

    it("handles undefined env gracefully", () => {
      expect(isStagingGuideEnabled("localhost", null)).toBe(true);
    });
  });
});
