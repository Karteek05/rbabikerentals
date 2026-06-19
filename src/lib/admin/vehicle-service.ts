import { recordAudit } from "@/lib/audit/service";
import {
  assertBengaluruCity,
  deleteVehicleById,
  getUserOrThrow,
  listBookings,
  listVehicles,
  upsertVehicle
} from "@/lib/data/repository";
import type {
  AdminVehicleUpdateRequest,
  AdminVehicleUpsertRequest
} from "@/lib/types/contracts";
import type { Role, Vehicle } from "@/lib/types/domain";
import { ApiException } from "@/lib/utils/errors";
import { newId } from "@/lib/utils/ids";

function assertAdmin(actor: { userId: string; role: Role }) {
  if (actor.role !== "admin") {
    throw new ApiException(403, "forbidden", "Only admin can manage vehicles.");
  }
}

function assertNonNegativeNumber(value: number, field: string) {
  if (!Number.isFinite(value) || value < 0) {
    throw new ApiException(400, "invalid_input", `${field} must be a non-negative number.`);
  }
}

function sanitizeImageUrls(imageUrls?: string[]) {
  if (!imageUrls) return [] as string[];
  const cleaned = imageUrls
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  return Array.from(new Set(cleaned)).slice(0, 12);
}

function assertCategory(value: string) {
  if (!["scooter", "bike", "ev_bike"].includes(value)) {
    throw new ApiException(400, "invalid_category", "category must be scooter, bike, or ev_bike.");
  }
}

async function assertPartnerOwner(ownerId: string) {
  const owner = await getUserOrThrow(ownerId);
  if (owner.role !== "partner_investor") {
    throw new ApiException(
      400,
      "invalid_owner",
      "owner_id must belong to a partner/investor account."
    );
  }
}

export async function listVehiclesForAdmin(options?: { includeInactive?: boolean }) {
  const vehicles = await listVehicles();
  const filtered = options?.includeInactive
    ? vehicles
    : vehicles.filter((vehicle) => vehicle.is_active);
  return filtered.sort((a, b) => a.id.localeCompare(b.id));
}

export async function createVehicleByAdmin(
  input: AdminVehicleUpsertRequest,
  actor: { userId: string; role: Role }
) {
  assertAdmin(actor);
  assertBengaluruCity(input.city ?? "bengaluru");
  await assertPartnerOwner(input.owner_id);
  assertCategory(input.category);
  if (!input.brand.trim() || !input.model.trim()) {
    throw new ApiException(400, "invalid_input", "brand and model are required.");
  }

  assertNonNegativeNumber(input.deposit_amount, "deposit_amount");
  assertNonNegativeNumber(input.rate_per_hour, "rate_per_hour");
  assertNonNegativeNumber(input.rate_per_day, "rate_per_day");
  assertNonNegativeNumber(input.rate_per_week, "rate_per_week");
  assertNonNegativeNumber(input.rate_per_month, "rate_per_month");

  const vehicle: Vehicle = {
    id: newId("veh"),
    owner_id: input.owner_id,
    city: "bengaluru",
    category: input.category,
    brand: input.brand.trim(),
    model: input.model.trim(),
    image_urls: sanitizeImageUrls(input.image_urls),
    is_active: input.is_active ?? true,
    deposit_amount: Math.round(input.deposit_amount),
    rate_per_hour: Math.round(input.rate_per_hour),
    rate_per_day: Math.round(input.rate_per_day),
    rate_per_week: Math.round(input.rate_per_week),
    rate_per_month: Math.round(input.rate_per_month)
  };

  const created = await upsertVehicle(vehicle);
  await recordAudit({
    actorId: actor.userId,
    actorRole: actor.role,
    action: "admin.vehicle_create",
    resourceType: "vehicle",
    resourceId: created.id,
    metadata: { owner_id: created.owner_id, brand: created.brand, model: created.model }
  });
  return created;
}

export async function updateVehicleByAdmin(
  vehicleId: string,
  input: AdminVehicleUpdateRequest,
  actor: { userId: string; role: Role }
) {
  assertAdmin(actor);

  const current = (await listVehicles()).find((item) => item.id === vehicleId);
  if (!current) {
    throw new ApiException(404, "vehicle_not_found", "Vehicle does not exist.");
  }

  if (input.city) assertBengaluruCity(input.city);
  if (input.owner_id) await assertPartnerOwner(input.owner_id);
  if (input.category) assertCategory(input.category);

  if (input.deposit_amount !== undefined) {
    assertNonNegativeNumber(input.deposit_amount, "deposit_amount");
  }
  if (input.rate_per_hour !== undefined) {
    assertNonNegativeNumber(input.rate_per_hour, "rate_per_hour");
  }
  if (input.rate_per_day !== undefined) {
    assertNonNegativeNumber(input.rate_per_day, "rate_per_day");
  }
  if (input.rate_per_week !== undefined) {
    assertNonNegativeNumber(input.rate_per_week, "rate_per_week");
  }
  if (input.rate_per_month !== undefined) {
    assertNonNegativeNumber(input.rate_per_month, "rate_per_month");
  }

  const updated: Vehicle = {
    ...current,
    owner_id: input.owner_id ?? current.owner_id,
    category: input.category ?? current.category,
    brand: input.brand?.trim() || current.brand,
    model: input.model?.trim() || current.model,
    image_urls:
      input.image_urls !== undefined
        ? sanitizeImageUrls(input.image_urls)
        : current.image_urls ?? [],
    is_active: input.is_active ?? current.is_active,
    deposit_amount:
      input.deposit_amount !== undefined
        ? Math.round(input.deposit_amount)
        : current.deposit_amount,
    rate_per_hour:
      input.rate_per_hour !== undefined ? Math.round(input.rate_per_hour) : current.rate_per_hour,
    rate_per_day:
      input.rate_per_day !== undefined ? Math.round(input.rate_per_day) : current.rate_per_day,
    rate_per_week:
      input.rate_per_week !== undefined ? Math.round(input.rate_per_week) : current.rate_per_week,
    rate_per_month:
      input.rate_per_month !== undefined
        ? Math.round(input.rate_per_month)
        : current.rate_per_month
  };

  const saved = await upsertVehicle(updated);
  await recordAudit({
    actorId: actor.userId,
    actorRole: actor.role,
    action: "admin.vehicle_update",
    resourceType: "vehicle",
    resourceId: saved.id,
    metadata: {
      updated_fields: Object.keys(input),
      is_active: saved.is_active
    }
  });
  return saved;
}

export async function deleteVehicleByAdmin(
  vehicleId: string,
  actor: { userId: string; role: Role }
) {
  assertAdmin(actor);
  const bookings = await listBookings({ vehicleId });
  if (bookings.length > 0) {
    throw new ApiException(
      409,
      "vehicle_has_bookings",
      "Vehicle has bookings history. Deactivate it instead of deleting."
    );
  }

  const deleted = await deleteVehicleById(vehicleId);
  if (!deleted) {
    throw new ApiException(404, "vehicle_not_found", "Vehicle does not exist.");
  }

  await recordAudit({
    actorId: actor.userId,
    actorRole: actor.role,
    action: "admin.vehicle_delete",
    resourceType: "vehicle",
    resourceId: deleted.id
  });
  return deleted;
}
