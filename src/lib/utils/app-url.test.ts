import { describe, expect, it } from "vitest";
import { getCustomerFacingBaseUrl, getPublicAuthClientBaseUrl, getServerAppBaseUrl } from "@/lib/utils/app-url";

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

  it("uses APP_PUBLIC_BASE_URL for customer-facing links in dev", () => {
    expect(
      getCustomerFacingBaseUrl({
        BETTER_AUTH_URL: "http://localhost:3000",
        APP_PUBLIC_BASE_URL: "https://rbabikerentals.vercel.app"
      })
    ).toBe("https://rbabikerentals.vercel.app");
  });
});
