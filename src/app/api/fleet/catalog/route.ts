import { PUBLIC_FLEET } from "@/lib/fleet/catalog";
import { listVehicles } from "@/lib/data/repository";
import { ok, fromError } from "@/lib/utils/http";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const vehicles = await listVehicles();
    const pricingById = new Map(vehicles.map((vehicle) => [vehicle.id, vehicle]));
    const items = PUBLIC_FLEET.map((catalogVehicle) => {
      const configured = pricingById.get(catalogVehicle.id);
      return configured
        ? {
            ...catalogVehicle,
            is_active: configured.is_active,
            deposit_amount: configured.deposit_amount,
            rate_per_hour: configured.rate_per_hour,
            rate_per_day: configured.rate_per_day,
            rate_per_week: configured.rate_per_week,
            rate_per_month: configured.rate_per_month,
            included_km_per_hour: configured.included_km_per_hour,
            included_km_per_day: configured.included_km_per_day,
            included_km_per_week: configured.included_km_per_week,
            included_km_per_month: configured.included_km_per_month,
            excess_km_rate: configured.excess_km_rate
          }
        : catalogVehicle;
    });
    return ok({ items });
  } catch (error) {
    return fromError(error);
  }
}
