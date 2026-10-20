import { requireApprovedPartner } from "@/lib/auth/partner-access";
import { listAllVehicleDocuments, listVehiclesByOwner } from "@/lib/data/repository";
import { getVehicleDisplayName } from "@/lib/fleet/display";
import { fromError, ok } from "@/lib/utils/http";

export async function GET(request: Request) {
  try {
    const actor = await requireApprovedPartner(request);
    const vehicles = await listVehiclesByOwner(actor.userId);
    const vehicleById = new Map(vehicles.map((vehicle) => [vehicle.id, vehicle]));
    const docs = (await listAllVehicleDocuments()).filter((doc) => vehicleById.has(doc.vehicle_id));
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const items = docs.map((doc) => {
      const vehicle = vehicleById.get(doc.vehicle_id)!;
      const expiry = doc.expires_at ? new Date(doc.expires_at) : null;
      const expiryDay = expiry && Number.isFinite(expiry.getTime()) ? Date.UTC(expiry.getUTCFullYear(), expiry.getUTCMonth(), expiry.getUTCDate()) : null;
      const days = expiryDay === null ? null : Math.ceil((expiryDay - today.getTime()) / 86_400_000);
      return {
        vehicle_id: vehicle.id,
        vehicle_label: getVehicleDisplayName(vehicle.id, vehicle),
        doc_type: doc.doc_type,
        expires_at: doc.expires_at ?? null,
        days_until_expiry: days
      };
    });
    return ok({ items });
  } catch (error) {
    return fromError(error);
  }
}
