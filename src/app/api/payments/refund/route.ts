import { requireActor } from "@/lib/auth/context";
import { refundPaymentForBooking } from "@/lib/payments/service";
import type { RefundPaymentRequest } from "@/lib/types/contracts";
import { fromError, ok, parseJson } from "@/lib/utils/http";

export async function POST(request: Request) {
  try {
    const actor = await requireActor(request, ["admin"]);
    const body = await parseJson<RefundPaymentRequest>(request);
    const result = await refundPaymentForBooking({
      bookingId: body.booking_id,
      amount: body.amount,
      reason: body.reason,
      actor
    });
    return ok(result, 201);
  } catch (error) {
    return fromError(error);
  }
}
