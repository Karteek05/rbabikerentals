import { approveBooking } from "@/lib/admin/service";
import { requireActor } from "@/lib/auth/context";
import type { ApproveBookingRequest } from "@/lib/types/contracts";
import { ok, fromError, parseJson } from "@/lib/utils/http";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireActor(request, ["admin"]);
    const { id } = await context.params;
    const body = await parseJson<ApproveBookingRequest>(request).catch(() => ({}));

    const updated = await approveBooking(id, body, actor);
    return ok({ booking: updated });
  } catch (error) {
    return fromError(error);
  }
}
