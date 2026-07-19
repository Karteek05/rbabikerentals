import { loadEnvConfig } from "@next/env";
import { inferCatalogVehicleId, PUBLIC_FLEET_BY_ID } from "@/lib/fleet/catalog";
import { listVehicles, upsertVehicle } from "@/lib/data/repository";

loadEnvConfig(process.cwd());

function catalogLabel(catalogId: string | null | undefined) {
  if (!catalogId) return "(not linked)";
  const catalog = PUBLIC_FLEET_BY_ID[catalogId];
  return catalog ? `${catalogId} · ${catalog.brand} ${catalog.model}` : catalogId;
}

async function main() {
  const vehicles = await listVehicles();
  const physical = vehicles.filter((vehicle) => vehicle.chassis_number?.trim());
  let updated = 0;

  const alreadyLinked = physical.filter((vehicle) => vehicle.catalog_vehicle_id?.trim());
  const needsLink = physical.filter((vehicle) => !vehicle.catalog_vehicle_id?.trim());

  console.log(`Physical units with chassis: ${physical.length}`);
  console.log(`Already linked: ${alreadyLinked.length}`);
  console.log(`Still unlinked: ${needsLink.length}`);
  console.log("");

  const byCatalog = new Map<string, number>();
  for (const vehicle of alreadyLinked) {
    const key = vehicle.catalog_vehicle_id ?? "unknown";
    byCatalog.set(key, (byCatalog.get(key) ?? 0) + 1);
  }
  if (byCatalog.size) {
    console.log("Linked breakdown:");
    for (const [catalogId, count] of [...byCatalog.entries()].sort()) {
      console.log(`  ${count} → ${catalogLabel(catalogId)}`);
    }
    console.log("");
  }

  for (const vehicle of needsLink) {
    const catalogVehicleId = inferCatalogVehicleId(vehicle);
    if (!catalogVehicleId) {
      console.log(
        `skip ${vehicle.id} (${vehicle.brand} ${vehicle.model}) — no customer catalog model yet`
      );
      continue;
    }

    await upsertVehicle({ ...vehicle, catalog_vehicle_id: catalogVehicleId });
    updated += 1;
    console.log(`linked ${vehicle.id} -> ${catalogLabel(catalogVehicleId)}`);
  }

  console.log("");
  console.log(`Done. Newly linked ${updated} physical unit(s).`);

  if (updated === 0 && alreadyLinked.length > 0) {
    console.log(
      "Nothing new to link — your Honda scooters are already mapped. For Dio bookings, edit individual units in Fleet Ops and set fleet model to Honda Dio 110."
    );
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
