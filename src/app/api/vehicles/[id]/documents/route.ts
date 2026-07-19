import { requireActor } from "@/lib/auth/context";
import { getVehicleOrThrow, listVehicleDocuments } from "@/lib/data/repository";
import { listBookings } from "@/lib/data/repository";
import { ApiException } from "@/lib/utils/errors";
import { fromError, ok } from "@/lib/utils/http";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireActor(request, ["customer", "partner_investor", "admin"]);
    const { id } = await context.params;

    const vehicle = await getVehicleOrThrow(id);

    let isAuthorized = false;

    if (actor.role === "admin") {
      isAuthorized = true;
    } else if (actor.role === "partner_investor") {
      if (vehicle.owner_id === actor.userId) {
        isAuthorized = true;
      }
    } else if (actor.role === "customer") {
      // Check if the customer has an active booking for this vehicle
      const bookings = await listBookings({ vehicleId: id, userId: actor.userId });
      const activeStatuses = ["payment_pending", "confirmed", "ongoing", "extension_requested", "extended"];
      
      const hasActiveBooking = bookings.some(b => activeStatuses.includes(b.status));
      if (hasActiveBooking) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      throw new ApiException(
        403,
        "forbidden",
        "You do not have permission to view documents for this vehicle."
      );
    }

    const documents = await listVehicleDocuments(id);
    return ok({ documents });
  } catch (error) {
    return fromError(error);
  }
}
