import { execSync } from "child_process";
import { copyFileSync, mkdirSync } from "fs";
import path from "path";
import { loadEnvConfig } from "@next/env";
import {
  findVehicleByChassis,
  listVehicles,
  upsertVehicle,
  upsertVehicleDocument
} from "@/lib/data/repository";
import { LOCAL_DOC_PREFIX } from "@/lib/vehicles/documents";
import { newId } from "@/lib/utils/ids";
import type { Vehicle, VehicleDocument } from "@/lib/types/domain";

loadEnvConfig(process.cwd());

type ParsedDoc = {
  file: string;
  path: string;
  doc_type: "rc" | "insurance" | "invoice";
  chassis_number: string | null;
  catalog_vehicle_id?: string | null;
};

function parseDocs(): ParsedDoc[] {
  const output = execSync("python scripts/parse_new_pdfs.py --json", {
    encoding: "utf8",
    cwd: process.cwd()
  });
  return JSON.parse(output) as ParsedDoc[];
}

function vehicleIdForChassis(chassis: string) {
  return `veh_${chassis.replace(/[^a-zA-Z0-9]/g, "").toLowerCase()}`;
}

async function ensureVehicle(
  chassis: string,
  createMissing: boolean,
  catalogVehicleId?: string | null
): Promise<Vehicle | null> {
  const normalized = chassis.trim().toUpperCase();
  const existing = await findVehicleByChassis(chassis);
  if (existing) {
    if (catalogVehicleId && !existing.catalog_vehicle_id) {
      return upsertVehicle({ ...existing, catalog_vehicle_id: catalogVehicleId });
    }
    return existing;
  }
  if (!createMissing) return null;

  const id = vehicleIdForChassis(chassis);
  const vehicles = await listVehicles();
  const byId = vehicles.find((vehicle) => vehicle.id === id);
  if (byId) {
    const existingChassis = byId.chassis_number?.trim().toUpperCase();
    if (!existingChassis) {
      return upsertVehicle({
        ...byId,
        chassis_number: chassis,
        catalog_vehicle_id: catalogVehicleId ?? byId.catalog_vehicle_id ?? null
      });
    }
    if (existingChassis === normalized) {
      return byId;
    }
    console.warn(
      `vehicle id ${id} already used for chassis ${existingChassis}; skipping ${chassis}`
    );
    return null;
  }

  return upsertVehicle({
    id,
    owner_id: "partner_001",
    city: "bengaluru",
    category: chassis.startsWith("MD625") ? "bike" : "scooter",
    brand: chassis.startsWith("MD625") ? "TVS" : "Honda",
    model: chassis.startsWith("MD625") ? "Raider" : "Fleet unit",
    chassis_number: chassis,
    catalog_vehicle_id: catalogVehicleId ?? null,
    registration_number: null,
    is_active: true,
    deposit_amount: 2000,
    rate_per_hour: 0,
    rate_per_day: 3200,
    rate_per_week: 1600,
    rate_per_month: 6000
  });
}

async function importDoc(row: ParsedDoc, createMissing: boolean) {
  if (!row.chassis_number) {
    console.warn(`skip ${row.file}: no chassis found`);
    return;
  }

  const vehicle = await ensureVehicle(row.chassis_number, createMissing, row.catalog_vehicle_id);
  if (!vehicle) {
    console.warn(`skip ${row.file}: no vehicle for chassis ${row.chassis_number}`);
    return;
  }

  const storageDir = path.join(process.cwd(), ".data", "vehicle-documents", vehicle.id);
  mkdirSync(storageDir, { recursive: true });
  const stampedName = `${Date.now()}-${row.doc_type}-${row.file.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const dest = path.join(storageDir, stampedName);
  copyFileSync(row.path, dest);

  const now = new Date().toISOString();
  const doc: VehicleDocument = {
    id: newId("vdoc"),
    vehicle_id: vehicle.id,
    doc_type: row.doc_type,
    file_url: `${LOCAL_DOC_PREFIX}${vehicle.id}/${stampedName}`,
    expires_at: row.doc_type === "insurance" ? new Date(Date.now() + 365 * 86400000).toISOString() : null,
    created_at: now,
    updated_at: now
  };
  await upsertVehicleDocument(doc);
  console.log(`imported ${row.doc_type} for ${vehicle.id} (${row.chassis_number}) from ${row.file}`);
}

async function run() {
  const matchOnly = process.argv.includes("--match-only");
  const createMissing = !matchOnly;
  const rows = parseDocs();
  for (const row of rows) {
    await importDoc(row, createMissing);
  }
  console.log("Import complete.");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
