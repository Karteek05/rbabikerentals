import { requireActor } from "@/lib/auth/context";
import { cancelBooking } from "@/lib/bookings/service";
import type { CancelBookingRequest } from "@/lib/types/contracts";
import { parseJson, ok, fromError } from "@/lib/utils/http";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireActor(request, ["customer", "admin"]);
    const body = await parseJson<CancelBookingRequest>(request);
    const { id } = await context.params;
    const result = await cancelBooking(id, body, actor);
    return ok(result);
  } catch (error) {
    return fromError(error);
  }
}
