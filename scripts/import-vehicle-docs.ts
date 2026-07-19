import { execSync } from "child_process";
import { copyFileSync, mkdirSync, readFileSync } from "fs";
import path from "path";
import { loadEnvConfig } from "@next/env";
import { getSupabaseServiceClient, isSupabaseConfigured } from "@/lib/db/supabase-client";
import { inferCatalogVehicleId, inferFleetUnitFromChassis, PUBLIC_FLEET } from "@/lib/fleet/catalog";
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

  const fleetUnit = inferFleetUnitFromChassis(chassis);

  return upsertVehicle({
    id,
    owner_id: "partner_001",
    city: "bengaluru",
    category: fleetUnit.category,
    brand: fleetUnit.brand,
    model: fleetUnit.model,
    chassis_number: chassis,
    catalog_vehicle_id:
      catalogVehicleId ??
      inferCatalogVehicleId({
        brand: fleetUnit.brand,
        model: fleetUnit.model,
        category: fleetUnit.category
      }),
    image_urls: [fleetUnit.image],
    registration_number: null,
    is_active: true,
    deposit_amount: 2000,
    rate_per_hour: 0,
    rate_per_day: 3200,
    rate_per_week: 1600,
    rate_per_month: 6000
  });
}

function vehicleDocBucket() {
  return process.env.SUPABASE_VEHICLE_DOC_BUCKET ?? "vehicle-documents";
}

async function ensureVehicleDocBucket() {
  const bucket = vehicleDocBucket();
  const supabase = getSupabaseServiceClient();
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  if (listError) {
    throw listError;
  }
  if (buckets?.some((item) => item.name === bucket)) {
    return bucket;
  }

  const { error } = await supabase.storage.createBucket(bucket, {
    public: false,
    fileSizeLimit: 15 * 1024 * 1024
  });
  if (error) {
    throw error;
  }
  console.log(`created storage bucket: ${bucket}`);
  return bucket;
}

async function storeDocumentFile(params: {
  vehicleId: string;
  docType: string;
  sourcePath: string;
  fileName: string;
}) {
  const stampedName = `${Date.now()}-${params.docType}-${params.fileName.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const relativePath = `${params.vehicleId}/${stampedName}`;

  if (isSupabaseConfigured()) {
    const bucket = await ensureVehicleDocBucket();
    const buffer = readFileSync(params.sourcePath);
    const supabase = getSupabaseServiceClient();
    const { error } = await supabase.storage.from(bucket).upload(relativePath, buffer, {
      contentType: "application/pdf",
      upsert: true
    });
    if (error) {
      throw error;
    }
    console.log(`uploaded to supabase://${bucket}/${relativePath}`);
    return `${LOCAL_DOC_PREFIX}${relativePath}`;
  }

  const storageDir = path.join(process.cwd(), ".data", "vehicle-documents", params.vehicleId);
  mkdirSync(storageDir, { recursive: true });
  const dest = path.join(storageDir, stampedName);
  copyFileSync(params.sourcePath, dest);
  return `${LOCAL_DOC_PREFIX}${relativePath}`;
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

  const fileUrl = await storeDocumentFile({
    vehicleId: vehicle.id,
    docType: row.doc_type,
    sourcePath: row.path,
    fileName: row.file
  });

  const now = new Date().toISOString();
  const doc: VehicleDocument = {
    id: newId("vdoc"),
    vehicle_id: vehicle.id,
    doc_type: row.doc_type,
    file_url: fileUrl,
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
