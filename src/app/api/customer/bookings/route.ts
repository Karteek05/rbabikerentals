import { requireActor } from "@/lib/auth/context";
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
        : await listBookings({ status, userId: actor.userId });
    return ok({ bookings });
  } catch (error) {
    return fromError(error);
  }
}

