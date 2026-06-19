import fs from "fs";
import path from "path";
import { describe, expect, test } from "vitest";

const schemaSql = fs.readFileSync(path.join(process.cwd(), "db", "schema.sql"), "utf8");

describe("database schema", () => {
  test("includes Better Auth tables required by the configured auth provider", () => {
    for (const table of ['"user"', "session", "account", "verification"]) {
      expect(schemaSql).toContain(`create table if not exists ${table}`);
    }

    expect(schemaSql).toContain('"phoneNumber" text unique');
    expect(schemaSql).toContain('"phoneNumberVerified" boolean');
    expect(schemaSql).toContain("role text");
    expect(schemaSql).toContain('references "user"(id) on delete cascade');
  });
});
