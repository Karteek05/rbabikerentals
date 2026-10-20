import { requireApprovedPartner } from "@/lib/auth/partner-access";
import { listVehicleBlocksByVehicleIds, listVehiclesByOwner } from "@/lib/data/repository";
import { fromError, ok } from "@/lib/utils/http";

export async function GET(request: Request) {
  try {
    const actor = await requireApprovedPartner(request);
    const vehicles = await listVehiclesByOwner(actor.userId);
    const items = await listVehicleBlocksByVehicleIds(vehicles.map((vehicle) => vehicle.id));
    return ok({ items });
  } catch (error) {
    return fromError(error);
  }
}
