import { assignBookingVehicle } from "@/lib/bookings/assignment";
import { requireActor } from "@/lib/auth/context";
import type { AssignBookingVehicleRequest } from "@/lib/types/contracts";
import { ApiException } from "@/lib/utils/errors";
import { ok, fromError, parseJson } from "@/lib/utils/http";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireActor(request, ["admin"]);
    const { id } = await context.params;
    const body = await parseJson<AssignBookingVehicleRequest>(request);
    if (!body.assigned_vehicle_id?.trim()) {
      throw new ApiException(400, "assigned_vehicle_required", "assigned_vehicle_id is required.");
    }
    const updated = await assignBookingVehicle(id, body.assigned_vehicle_id.trim(), actor);
    return ok({ booking: updated });
  } catch (error) {
    return fromError(error);
  }
}
