import {
  getUserOrThrow,
  getVehicleOrThrow,
  listVehicleLiveLocations,
  upsertVehicleLiveLocation
} from "@/lib/data/repository";
import type { Role, VehicleLiveLocation } from "@/lib/types/domain";
import { ApiException } from "@/lib/utils/errors";

export interface UpdateVehicleTrackingInput {
  vehicle_id: string;
  latitude: number;
  longitude: number;
  speed_kmph?: number | null;
  heading_deg?: number | null;
  source?: string;
}

function assertCoordinates(latitude: number, longitude: number) {
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    throw new ApiException(400, "invalid_latitude", "Latitude must be between -90 and 90.");
  }
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw new ApiException(400, "invalid_longitude", "Longitude must be between -180 and 180.");
  }
}

export async function listTrackingForActor(actor: {
  userId: string;
  role: Role;
}): Promise<{ items: VehicleLiveLocation[]; as_of: string }> {
  const user = await getUserOrThrow(actor.userId);
  if (user.role !== actor.role && actor.role !== "admin") {
    throw new ApiException(403, "forbidden", "Actor role mismatch.");
  }

  const items =
    actor.role === "admin"
      ? await listVehicleLiveLocations()
      : await listVehicleLiveLocations({ ownerId: actor.userId });

  const sorted = [...items].sort((a, b) => a.vehicle_id.localeCompare(b.vehicle_id));
  return { items: sorted, as_of: new Date().toISOString() };
}

export async function upsertTrackingLocation(
  input: UpdateVehicleTrackingInput
): Promise<VehicleLiveLocation> {
  assertCoordinates(input.latitude, input.longitude);

  if (input.speed_kmph !== undefined && input.speed_kmph !== null && input.speed_kmph < 0) {
    throw new ApiException(400, "invalid_speed", "Speed cannot be negative.");
  }

  if (
    input.heading_deg !== undefined &&
    input.heading_deg !== null &&
    (input.heading_deg < 0 || input.heading_deg >= 360)
  ) {
    throw new ApiException(400, "invalid_heading", "Heading must be between 0 and 359.");
  }

  await getVehicleOrThrow(input.vehicle_id);

  const payload: VehicleLiveLocation = {
    vehicle_id: input.vehicle_id,
    latitude: Number(input.latitude.toFixed(6)),
    longitude: Number(input.longitude.toFixed(6)),
    speed_kmph: input.speed_kmph ?? null,
    heading_deg: input.heading_deg ?? null,
    source: input.source?.trim() || "internal_ping",
    updated_at: new Date().toISOString()
  };

  return upsertVehicleLiveLocation(payload);
}
