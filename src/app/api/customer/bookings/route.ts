import { requireActor } from "@/lib/auth/context";
import { listCustomerBookings } from "@/lib/account/customer-bookings";
import { listBookings } from "@/lib/data/repository";
import { ok, fromError } from "@/lib/utils/http";

export async function GET(request: Request) {
  try {
    const actor = await requireActor(request, ["customer", "admin"]);
    const url = new URL(request.url);
    const status = url.searchParams.get("status") ?? undefined;

    const bookings =
      actor.role === "admin"
        ? await listBookings({ status })
        : await listCustomerBookings({ userId: actor.userId, status });
    return ok({ bookings });
  } catch (error) {
    return fromError(error);
  }
}

