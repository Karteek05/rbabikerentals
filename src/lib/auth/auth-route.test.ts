import { describe, expect, it } from "vitest";
import {
  collectAuthCookieNames,
  expireAuthCookieHeader,
  isGetSessionRequest,
  resolveAuthCookieDomain,
  stripAuthCookieNames
} from "@/lib/auth/auth-route";

describe("auth route helpers", () => {
  it("detects get-session requests", () => {
    expect(
      isGetSessionRequest(
        new Request("https://www.rbabikerentals.com/api/auth/get-session", { method: "GET" })
      )
    ).toBe(true);
    expect(
      isGetSessionRequest(
        new Request("https://www.rbabikerentals.com/api/auth/sign-in/email", {
          method: "POST"
        })
      )
    ).toBe(false);
  });

  it("collects secure and chunked auth cookies", () => {
    const names = collectAuthCookieNames(
      "__Secure-rba.session_token=abc; __Secure-rba.session_data.0=part1; other=value"
    );

    expect(names).toEqual(["__Secure-rba.session_token", "__Secure-rba.session_data.0"]);
  });

  it("strips only targeted auth cookies", () => {
    const stripped = stripAuthCookieNames(
      "__Secure-rba.session_token=abc; __Secure-rba.session_data.0=bad; other=value",
      new Set(["__Secure-rba.session_data.0"])
    );

    expect(stripped).toBe("__Secure-rba.session_token=abc; other=value");
  });

  it("expires secure cookies in production", () => {
    const previousNodeEnv = process.env.NODE_ENV;
    const previousBaseUrl = process.env.BETTER_AUTH_URL;
    process.env.NODE_ENV = "production";
    process.env.BETTER_AUTH_URL = "https://www.rbabikerentals.com";
    expect(expireAuthCookieHeader("__Secure-rba.session_data")).toContain("Secure");
    expect(expireAuthCookieHeader("__Secure-rba.session_data")).toContain(
      "Domain=rbabikerentals.com"
    );
    expect(resolveAuthCookieDomain()).toBe("rbabikerentals.com");
    process.env.NODE_ENV = previousNodeEnv;
    process.env.BETTER_AUTH_URL = previousBaseUrl;
  });
});
