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

  test("allows memory auth only outside production", () => {
    expect(resolveAuthDatabaseUrl({ APP_ENV: "development" })).toBeUndefined();
  });

  test("ignores database URLs outside production", () => {
    expect(
      resolveAuthDatabaseUrl({
        APP_ENV: "development",
        SUPABASE_DB_URL: "postgres://stale-local-url"
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
