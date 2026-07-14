import { requireApprovedPartner } from "@/lib/auth/partner-access";
import { getPartnerVehicles } from "@/lib/partner/service";
import { ok, fromError } from "@/lib/utils/http";

export async function GET(request: Request) {
  try {
    const actor = await requireApprovedPartner(request);
    const result = await getPartnerVehicles(actor.userId);
    return ok(result);
  } catch (error) {
    return fromError(error);
  }
}
