import { requireActor } from "@/lib/auth/context";
import { pollDigilockerStatus } from "@/lib/kyc/service";
import { ok, fromError } from "@/lib/utils/http";
import { enforceRateLimit } from "@/lib/security/rate-limit";


export async function GET(
  request: Request,
  context: { params: Promise<{ requestId: string }> }
) {
  try {
    const actor = await requireActor(request, ["customer", "admin"]);
    const { requestId } = await context.params;
    await enforceRateLimit(
      `kyc-status:${actor.userId}`,
      30,
      60_000,
      "Too many identity status checks. Please wait before trying again."
    );

    const result = await pollDigilockerStatus(requestId, actor);
    return ok(result);
  } catch (error) {
    return fromError(error);
  }
}
