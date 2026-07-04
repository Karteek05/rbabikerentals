import { rejectBooking } from "@/lib/admin/service";
import { requireActor } from "@/lib/auth/context";
import type { RejectBookingRequest } from "@/lib/types/contracts";
import { ok, fromError, parseJson } from "@/lib/utils/http";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireActor(request, ["admin"]);
    const { id } = await context.params;
    const body = await parseJson<RejectBookingRequest>(request);

    const booking = await rejectBooking(id, body, actor);
    return ok({ booking });
  } catch (error) {
    return fromError(error);
  }
}
