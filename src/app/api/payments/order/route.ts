import { requireActor } from "@/lib/auth/context";
import { createOrderForBooking } from "@/lib/payments/service";
import type { CreatePaymentOrderRequest } from "@/lib/types/contracts";
import { parseJson, ok, fromError } from "@/lib/utils/http";

export async function POST(request: Request) {
  try {
    const actor = await requireActor(request, ["customer", "admin"]);
    const body = await parseJson<CreatePaymentOrderRequest>(request);
    const order = await createOrderForBooking(body.booking_id, actor);
    return ok({ order }, 201);
  } catch (error) {
    return fromError(error);
  }
}
