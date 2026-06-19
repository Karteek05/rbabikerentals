import { recordAudit } from "@/lib/audit/service";
import { getVehicleOrThrow, insertVehicleBlock } from "@/lib/data/repository";
import type { Role } from "@/lib/types/domain";
import type { BlockVehicleRequest } from "@/lib/types/contracts";
import { ApiException } from "@/lib/utils/errors";
import { newId } from "@/lib/utils/ids";

export async function blockVehicle(
  vehicleId: string,
  input: BlockVehicleRequest,
  actor: { userId: string; role: Role }
) {
  const vehicle = await getVehicleOrThrow(vehicleId);

  const canManageAsPartner =
    actor.role === "partner_investor" && vehicle.owner_id === actor.userId;
  if (!canManageAsPartner && actor.role !== "admin") {
    throw new ApiException(403, "forbidden", "Not allowed to block this vehicle.");
  }

  const startsAt = new Date(input.starts_at).getTime();
  const endsAt = new Date(input.ends_at).getTime();
  if (!Number.isFinite(startsAt) || !Number.isFinite(endsAt) || startsAt >= endsAt) {
    throw new ApiException(
      400,
      "invalid_time_window",
      "Invalid block window start/end time."
    );
  }

  const blockWindow = {
    id: newId("block"),
    vehicle_id: vehicleId,
    starts_at: input.starts_at,
    ends_at: input.ends_at,
    reason: input.reason,
    created_by: actor.userId,
    created_at: new Date().toISOString()
  };

  await insertVehicleBlock(blockWindow);
  await recordAudit({
    actorId: actor.userId,
    actorRole: actor.role,
    action: "vehicle.block",
    resourceType: "vehicle",
    resourceId: vehicleId,
    metadata: {
      starts_at: input.starts_at,
      ends_at: input.ends_at,
      reason: input.reason
    }
  });

  return blockWindow;
}
