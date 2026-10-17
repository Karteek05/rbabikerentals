import { requireActor } from "@/lib/auth/context";
import { listApprovedPartnersForAdmin } from "@/lib/admin/partner-onboarding-service";
import { listVehiclesForAdmin } from "@/lib/admin/vehicle-service";
import { listAllVehicleDocuments } from "@/lib/data/repository";
import { fromError, ok } from "@/lib/utils/http";

export async function GET(request: Request) {
  try {
    await requireActor(request, ["admin"]);
    const [vehicles, documents, partners] = await Promise.all([
      listVehiclesForAdmin({ includeInactive: true }),
      listAllVehicleDocuments(),
      listApprovedPartnersForAdmin()
    ]);
    const partnerNameById = new Map(partners.map((partner) => [partner.id, partner.name]));
    const vehiclesWithOwners = vehicles.map((vehicle) => ({
      ...vehicle,
      owner_name: partnerNameById.get(vehicle.owner_id) ?? "Investor account"
    }));
    const vehicleById = new Map(vehiclesWithOwners.map((vehicle) => [vehicle.id, vehicle]));
    const documentRows = documents.flatMap((document) => {
      const vehicle = vehicleById.get(document.vehicle_id);
      if (!vehicle) return [];
      return [{ document, vehicle, owner_name: vehicle.owner_name }];
    });
    return ok({ vehicles: vehiclesWithOwners, documents: documentRows });
  } catch (error) {
    return fromError(error);
  }
}
