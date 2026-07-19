import { describe, expect, test } from "vitest";
import { resolveAuthDatabaseUrl } from "./better-auth";

describe("Better Auth configuration", () => {
  test("requires a persistent database URL in production", () => {
    expect(() =>
      resolveAuthDatabaseUrl({
        APP_ENV: "production"
      })
    ).toThrow("SUPABASE_DB_URL or DATABASE_URL is required in production.");
  });

  test("treats NODE_ENV=production as production for auth database resolution", () => {
    expect(
      resolveAuthDatabaseUrl({
        NODE_ENV: "production",
        DATABASE_URL: "postgres://supabase"
      })
    ).toBe("postgres://supabase");
  });

  test("allows memory auth when no database URL is configured", () => {
    expect(resolveAuthDatabaseUrl({ APP_ENV: "development" })).toBeUndefined();
  });

  test("uses the configured database in development for shared Supabase auth", () => {
    expect(
      resolveAuthDatabaseUrl({
        APP_ENV: "development",
        DATABASE_URL: "postgres://supabase"
      })
    ).toBe("postgres://supabase");
  });

  test("can force memory auth in development with AUTH_USE_MEMORY", () => {
    expect(
      resolveAuthDatabaseUrl({
        APP_ENV: "development",
        DATABASE_URL: "postgres://supabase",
        AUTH_USE_MEMORY: "true"
      })
    ).toBeUndefined();
  });

  test("prefers the Supabase database URL when configured", () => {
    expect(
      resolveAuthDatabaseUrl({
        APP_ENV: "production",
        DATABASE_URL: "postgres://fallback",
        SUPABASE_DB_URL: "postgres://supabase"
      })
    ).toBe("postgres://supabase");
  });
});
