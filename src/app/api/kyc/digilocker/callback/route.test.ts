import { afterEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/kyc/digilocker/callback/route";

const originalWebhookSecret = process.env.SETU_WEBHOOK_SECRET;

afterEach(() => {
  if (originalWebhookSecret === undefined) {
    delete process.env.SETU_WEBHOOK_SECRET;
  } else {
    process.env.SETU_WEBHOOK_SECRET = originalWebhookSecret;
  }
});

describe("DigiLocker callback route", () => {
  it("rejects a callback with an invalid shared secret before processing its payload", async () => {
    process.env.SETU_WEBHOOK_SECRET = "local-test-secret";
    const request = new Request("http://localhost/api/kyc/digilocker/callback", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-setu-webhook-secret": "wrong-secret"
      },
      body: "{}"
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: { code: "invalid_callback_secret" }
    });
  });
});
