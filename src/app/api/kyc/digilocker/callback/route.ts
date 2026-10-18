import { handleDigilockerCallback } from "@/lib/kyc/service";
import type { KycCallbackRequest } from "@/lib/types/contracts";
import { ApiException } from "@/lib/utils/errors";
import { parseJson, ok, fromError } from "@/lib/utils/http";
import { enforceRateLimit } from "@/lib/security/rate-limit";


export async function POST(request: Request) {
  try {
    const expectedSecret = process.env.SETU_WEBHOOK_SECRET;
    const providedSecret =
      request.headers.get("x-setu-webhook-secret") ??
      request.headers.get("x-webhook-secret");

    if (!expectedSecret) {
      throw new ApiException(
        500,
        "setu_webhook_secret_missing",
        "SETU_WEBHOOK_SECRET is missing."
      );
    }

    if (providedSecret !== expectedSecret) {
      throw new ApiException(401, "invalid_callback_secret", "Invalid KYC callback secret.");
    }
    await enforceRateLimit("setu-callback", 120, 60_000);


    const body = await parseJson<KycCallbackRequest>(request);
    const updated = await handleDigilockerCallback({
      requestId: body.requestId,
      status: body.status,
      aadhaarVerified: body.aadhaarVerified,
      dlVerified: body.dlVerified,
      cibilScore: body.cibilScore,
      failureReason: body.failureReason
    });
    return ok({ kyc: updated });
  } catch (error) {
    return fromError(error);
  }
}
