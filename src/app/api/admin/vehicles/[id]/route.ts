import { requireActor } from "@/lib/auth/context";
import {
  deleteVehicleByAdmin,
  updateVehicleByAdmin
} from "@/lib/admin/vehicle-service";
import type { AdminVehicleUpdateRequest } from "@/lib/types/contracts";
import { fromError, ok, parseJson } from "@/lib/utils/http";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireActor(request, ["admin"]);
    const body = await parseJson<AdminVehicleUpdateRequest>(request);
    const { id } = await context.params;
    const vehicle = await updateVehicleByAdmin(id, body, actor);
    return ok({ vehicle });
  } catch (error) {
    return fromError(error);
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireActor(request, ["admin"]);
    const { id } = await context.params;
    const vehicle = await deleteVehicleByAdmin(id, actor);
    return ok({ vehicle });
  } catch (error) {
    return fromError(error);
  }
}
