import { requireActor } from "@/lib/auth/context";
import { rejectBooking } from "@/lib/bookings/service";
import { ok, fromError } from "@/lib/utils/http";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireActor(request, ["admin"]);
    const { id } = await context.params;
    const booking = await rejectBooking(id, actor);
    return ok({ booking });
  } catch (error) {
    return fromError(error);
  }
}
