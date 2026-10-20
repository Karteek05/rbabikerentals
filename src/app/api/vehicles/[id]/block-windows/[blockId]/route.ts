import { requireApprovedPartner } from "@/lib/auth/partner-access";
import { recordAudit } from "@/lib/audit/service";
import { deleteVehicleBlock, getVehicleOrThrow } from "@/lib/data/repository";
import { ApiException } from "@/lib/utils/errors";
import { fromError, ok } from "@/lib/utils/http";

export async function DELETE(request: Request, context: { params: Promise<{ id: string; blockId: string }> }) {
  try {
    const actor = await requireApprovedPartner(request);
    const { id, blockId } = await context.params;
    const vehicle = await getVehicleOrThrow(id);
    if (actor.role !== "admin" && vehicle.owner_id !== actor.userId) {
      throw new ApiException(403, "forbidden", "You can remove maintenance windows only for vehicles you own.");
    }
    const removed = await deleteVehicleBlock(vehicle.id, blockId);
    if (!removed) throw new ApiException(404, "block_window_not_found", "Maintenance window does not exist for this vehicle.");
    await recordAudit({
      actorId: actor.userId,
      actorRole: actor.role,
      action: actor.role === "admin" ? "admin.vehicle_block_delete" : "partner.vehicle_block_delete",
      resourceType: "vehicle_block_window",
      resourceId: blockId,
      metadata: { vehicle_id: vehicle.id }
    });
    return ok({ vehicle_id: vehicle.id, block_id: blockId, deleted: true });
  } catch (error) {
    return fromError(error);
  }
}
