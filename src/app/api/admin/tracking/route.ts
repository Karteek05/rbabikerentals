import { requireActor } from "@/lib/auth/context";
import { listTrackingForActor } from "@/lib/tracking/service";
import { fromError, ok } from "@/lib/utils/http";

export async function GET(request: Request) {
  try {
    const actor = await requireActor(request, ["admin"]);
    const tracking = await listTrackingForActor(actor);
    return ok(tracking);
  } catch (error) {
    return fromError(error);
  }
}
