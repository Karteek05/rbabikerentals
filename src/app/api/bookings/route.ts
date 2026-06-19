import { requireActor } from "@/lib/auth/context";
import { createBooking } from "@/lib/bookings/service";
import type { CreateBookingRequest } from "@/lib/types/contracts";
import { parseJson, ok, fromError } from "@/lib/utils/http";

export async function POST(request: Request) {
  try {
    const actor = await requireActor(request, ["customer", "admin"]);
    const body = await parseJson<CreateBookingRequest>(request);
    const booking = await createBooking(body, actor);
    return ok({ booking }, 201);
  } catch (error) {
    return fromError(error);
  }
}
