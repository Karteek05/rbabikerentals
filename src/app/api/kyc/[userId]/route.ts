import { requireActor } from "@/lib/auth/context";
import { getKycStatus } from "@/lib/kyc/service";
import { ApiException } from "@/lib/utils/errors";
import { ok, fromError } from "@/lib/utils/http";

export async function GET(
  request: Request,
  context: { params: Promise<{ userId: string }> }
) {
  try {
    const actor = await requireActor(request, ["customer", "admin"]);
    const { userId } = await context.params;

    if (actor.role === "customer" && actor.userId !== userId) {
      throw new ApiException(
        403,
        "forbidden",
        "Customer can view only own KYC status."
      );
    }

    const kyc = await getKycStatus(userId);
    return ok(kyc);
  } catch (error) {
    return fromError(error);
  }
}
