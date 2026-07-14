import { loadEnvConfig } from "@next/env";
import {
  upsertUser,
  upsertVehicle,
  insertVehicleDocument,
  upsertVehicleLiveLocation
} from "@/lib/data/repository";
import { PUBLIC_FLEET } from "@/lib/fleet/catalog";

loadEnvConfig(process.cwd());

async function run() {
  await upsertUser({
    id: "cust_001",
    name: "Rahul Customer",
    role: "customer",
    city: "bengaluru",
    kyc_status: "not_started",
    email: "rahul@example.com",
    phone: "+919876543210"
  });
  await upsertUser({
    id: "cust_002",
    name: "Asha Customer",
    role: "customer",
    city: "bengaluru",
    kyc_status: "not_started",
    email: "asha@example.com",
    phone: "+919876543211"
  });
  await upsertUser({
    id: "partner_001",
    name: "Nikhil Fleet Partner",
    role: "partner_investor",
    city: "bengaluru",
    kyc_status: "verified",
    partner_application_status: "approved"
  });
  await upsertUser({
    id: "admin_001",
    name: "RBA Admin",
    role: "admin",
    city: "bengaluru",
    kyc_status: "verified"
  });

  for (const vehicle of PUBLIC_FLEET) {
    await upsertVehicle({
      id: vehicle.id,
      owner_id: "partner_001",
      city: vehicle.city,
      category: vehicle.category,
      brand: vehicle.brand,
      model: vehicle.model,
      image_urls: [vehicle.image],
      is_active: vehicle.is_active,
      deposit_amount: vehicle.deposit_amount,
      rate_per_hour: vehicle.rate_per_hour,
      rate_per_day: vehicle.rate_per_day,
      rate_per_week: vehicle.rate_per_week,
      rate_per_month: vehicle.rate_per_month
    });
  }

  await upsertVehicleLiveLocation({
    vehicle_id: "veh_001",
    latitude: 12.9716,
    longitude: 77.5946,
    speed_kmph: 24,
    heading_deg: 86,
    source: "seed_simulator",
    updated_at: new Date().toISOString()
  });
  await upsertVehicleLiveLocation({
    vehicle_id: "veh_002",
    latitude: 12.9352,
    longitude: 77.6245,
    speed_kmph: 39,
    heading_deg: 118,
    source: "seed_simulator",
    updated_at: new Date().toISOString()
  });
  await upsertVehicleLiveLocation({
    vehicle_id: "veh_003",
    latitude: 12.9989,
    longitude: 77.5926,
    speed_kmph: 0,
    heading_deg: 0,
    source: "seed_simulator",
    updated_at: new Date().toISOString()
  });

  await insertVehicleDocument({
    id: `doc_${Date.now()}`,
    vehicle_id: "veh_001",
    doc_type: "insurance",
    file_url: "https://example.com/insurance/veh_001.pdf",
    expires_at: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  });

  console.log("Seed complete.");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
