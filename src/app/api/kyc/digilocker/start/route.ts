import { requireActor } from "@/lib/auth/context";
import { startDigilockerKyc } from "@/lib/kyc/service";
import type { KycStartRequest } from "@/lib/types/contracts";
import { parseJson, ok, fromError } from "@/lib/utils/http";
import { ApiException } from "@/lib/utils/errors";

export async function POST(request: Request) {
  try {
    const actor = await requireActor(request, ["customer", "admin"]);
    const body = await parseJson<KycStartRequest>(request);

    if (actor.role === "customer" && actor.userId !== body.user_id) {
      throw new ApiException(
        403,
        "forbidden",
        "Customer can start KYC only for own user."
      );
    }

    const result = await startDigilockerKyc(body.user_id);
    return ok(result, 201);
  } catch (error) {
    return fromError(error);
  }
}
