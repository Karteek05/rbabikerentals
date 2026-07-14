import { requireApprovedPartner } from "@/lib/auth/partner-access";
import { listTrackingForActor } from "@/lib/tracking/service";
import { fromError, ok } from "@/lib/utils/http";

export async function GET(request: Request) {
  try {
    const actor = await requireApprovedPartner(request);
    const tracking = await listTrackingForActor(actor);
    return ok(tracking);
  } catch (error) {
    return fromError(error);
  }
}
