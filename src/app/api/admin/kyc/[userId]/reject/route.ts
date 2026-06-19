import { requireActor } from "@/lib/auth/context";
import { rejectKyc } from "@/lib/kyc/service";
import type { KycAdminDecisionRequest } from "@/lib/types/contracts";
import { parseJson, ok, fromError } from "@/lib/utils/http";

export async function POST(
  request: Request,
  context: { params: Promise<{ userId: string }> }
) {
  try {
    const actor = await requireActor(request, ["admin"]);
    const { userId } = await context.params;
    const body = await parseJson<KycAdminDecisionRequest>(request);
    const record = await rejectKyc(
      userId,
      actor.userId,
      body.reason ?? "KYC rejected by admin"
    );
    return ok({ kyc: record });
  } catch (error) {
    return fromError(error);
  }
}

