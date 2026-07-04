import { requireActor } from "@/lib/auth/context";
import { confirmRazorpayCheckoutPayment } from "@/lib/payments/service";
import type { ConfirmPaymentRequest } from "@/lib/types/contracts";
import { parseJson, ok, fromError } from "@/lib/utils/http";

export async function POST(request: Request) {
  try {
    const actor = await requireActor(request, ["customer", "admin"]);
    const body = await parseJson<ConfirmPaymentRequest>(request);
    const result = await confirmRazorpayCheckoutPayment({
      bookingId: body.booking_id,
      orderId: body.razorpay_order_id,
      paymentId: body.razorpay_payment_id,
      signature: body.razorpay_signature,
      actor
    });
    return ok(result);
  } catch (error) {
    return fromError(error);
  }
}
