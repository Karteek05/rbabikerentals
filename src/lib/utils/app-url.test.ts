import { describe, expect, it } from "vitest";
import { getServerAppBaseUrl, getPublicAuthClientBaseUrl } from "@/lib/utils/app-url";

describe("app URL resolution", () => {
  it("uses the Vercel production URL instead of localhost from committed env", () => {
    expect(
      getServerAppBaseUrl({
        APP_BASE_URL: "http://localhost:3000",
        VERCEL_PROJECT_PRODUCTION_URL: "rba.example.com"
      })
    ).toBe("https://rba.example.com");
  });

  it("keeps browser auth same-origin when no public URL is configured", () => {
    expect(getPublicAuthClientBaseUrl({})).toBeUndefined();
  });
});
