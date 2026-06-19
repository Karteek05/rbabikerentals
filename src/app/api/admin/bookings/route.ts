import { requireActor } from "@/lib/auth/context";
import { listBookingsForAdmin } from "@/lib/admin/service";
import { ok, fromError } from "@/lib/utils/http";

export async function GET(request: Request) {
  try {
    await requireActor(request, ["admin"]);
    const url = new URL(request.url);
    const status = url.searchParams.get("status") ?? undefined;
    const bookings = await listBookingsForAdmin({ status });
    return ok({ bookings });
  } catch (error) {
    return fromError(error);
  }
}
