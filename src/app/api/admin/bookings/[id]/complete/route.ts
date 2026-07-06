import { completeBooking } from "@/lib/bookings/lifecycle";
import { requireActor } from "@/lib/auth/context";
import { ok, fromError } from "@/lib/utils/http";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireActor(request, ["admin"]);
    const { id } = await context.params;
    const updated = await completeBooking(id, actor);
    return ok({ booking: updated });
  } catch (error) {
    return fromError(error);
  }
}
