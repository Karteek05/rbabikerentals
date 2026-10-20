import { requireActor } from "@/lib/auth/context";
import { listBookingsForAdmin } from "@/lib/admin/service";
import { getLatestPaymentOrderForBooking } from "@/lib/data/repository";
import { fromError, ok } from "@/lib/utils/http";

export async function GET(request: Request) {
  try {
    await requireActor(request, ["admin"]);
    const bookings = await listBookingsForAdmin();
    const items = await Promise.all(bookings.map(async (booking) => ({ booking, payment: await getLatestPaymentOrderForBooking(booking.id) })));
    const keyId = process.env.RAZORPAY_KEY_ID ?? "";
    const keySecret = process.env.RAZORPAY_KEY_SECRET ?? "";
    const mode = !keyId || !keySecret ? "unconfigured" : keyId.startsWith("rzp_test_") ? "test" : keyId.startsWith("rzp_live_") ? "live" : "unknown";
    return ok({ items, razorpay_mode: mode });
  } catch (error) { return fromError(error); }
}
