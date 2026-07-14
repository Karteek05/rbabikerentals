import { requireActor } from "@/lib/auth/context";
import { submitPartnerApplication } from "@/lib/admin/partner-onboarding-service";
import { ok, fromError, parseJson } from "@/lib/utils/http";
import type { PartnerApplyRequest } from "@/lib/types/contracts";

export async function POST(request: Request) {
  try {
    const actor = await requireActor(request);
    const body = await parseJson<PartnerApplyRequest>(request);
    const result = await submitPartnerApplication(actor.userId, body);
    return ok(result);
  } catch (error) {
    return fromError(error);
  }
}
