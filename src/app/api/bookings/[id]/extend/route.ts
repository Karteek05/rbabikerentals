import { requireActor } from "@/lib/auth/context";
import { extendBooking } from "@/lib/bookings/service";
import type { ExtendBookingRequest } from "@/lib/types/contracts";
import { parseJson, ok, fromError } from "@/lib/utils/http";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireActor(request, ["customer", "admin"]);
    const body = await parseJson<ExtendBookingRequest>(request);
    const { id } = await context.params;
    const result = await extendBooking(id, body, actor);
    return ok(result);
  } catch (error) {
    return fromError(error);
  }
}
