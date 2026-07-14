import type {
  AuditEvent,
  Booking,
  DamageIncident,
  KycRecord,
  NotificationJob,
  PaymentEvent,
  PaymentOrder,
  User,
  Vehicle,
  VehicleLiveLocation,
  VehicleDocument,
  VehicleBlockWindow
} from "@/lib/types/domain";

const now = new Date().toISOString();

const generateVehicles = (): Vehicle[] => {
  const vehicles: Vehicle[] = [];
  let idCounter = 1;

  for (let i = 0; i < 15; i++) {
    vehicles.push({
      id: `veh_${String(idCounter++).padStart(3, "0")}`,
      owner_id: "partner_001",
      city: "bengaluru",
      category: "scooter",
      brand: "Honda",
      model: "Activa 110",
      image_urls: ["/images/services/activa-6g.svg"],
      is_active: true,
      deposit_amount: 2000,
      rate_per_hour: 50,
      rate_per_day: 250,
      rate_per_week: 1600,
      rate_per_month: 6000
    });
  }

  for (let i = 0; i < 5; i++) {
    vehicles.push({
      id: `veh_${String(idCounter++).padStart(3, "0")}`,
      owner_id: "partner_001",
      city: "bengaluru",
      category: "scooter",
      brand: "Honda",
      model: "Dio 110",
      image_urls: ["/images/services/activa-6g.svg"],
      is_active: true,
      deposit_amount: 2000,
      rate_per_hour: 50,
      rate_per_day: 250,
      rate_per_week: 1600,
      rate_per_month: 6000
    });
  }

  for (let i = 0; i < 5; i++) {
    vehicles.push({
      id: `veh_${String(idCounter++).padStart(3, "0")}`,
      owner_id: "partner_001",
      city: "bengaluru",
      category: "scooter",
      brand: "TVS",
      model: "Jupiter 125",
      image_urls: ["/images/services/access-125.svg"],
      is_active: true,
      deposit_amount: 2000,
      rate_per_hour: 55,
      rate_per_day: 260,
      rate_per_week: 1625,
      rate_per_month: 6500
    });
  }

  return vehicles;
};

export const store: {
  users: User[];
  vehicles: Vehicle[];
  bookings: Booking[];
  kycRecords: KycRecord[];
  vehicleBlocks: VehicleBlockWindow[];
  vehicleLiveLocations: VehicleLiveLocation[];
  damageIncidents: DamageIncident[];
  auditEvents: AuditEvent[];
  paymentOrders: PaymentOrder[];
  paymentEvents: PaymentEvent[];
  vehicleDocuments: VehicleDocument[];
  notificationJobs: NotificationJob[];
} = {
  users: [
    {
      id: "cust_001",
      name: "Rahul Customer",
      role: "customer",
      city: "bengaluru",
      kyc_status: "not_started",
      email: "rahul@example.com",
      phone: "+919876543210"
    },
    {
      id: "cust_002",
      name: "Asha Customer",
      role: "customer",
      city: "bengaluru",
      kyc_status: "not_started",
      email: "asha@example.com",
      phone: "+919876543211"
    },
    {
      id: "partner_001",
      name: "Nikhil Fleet Partner",
      role: "partner_investor",
      city: "bengaluru",
      kyc_status: "verified",
      partner_application_status: "approved"
    },
    {
      id: "admin_001",
      name: "RBA Admin",
      role: "admin",
      city: "bengaluru",
      kyc_status: "verified"
    }
  ],
  vehicles: generateVehicles(),
  bookings: [],
  kycRecords: [
    {
      user_id: "cust_001",
      status: "verified",
      provider: "setu_digilocker",
      aadhaar_verified: true,
      dl_verified: true,
      cibil_score: 782,
      cibil_risk_band: "low",
      cibil_checked_at: now,
      pan_last4: "1234",
      needs_manual_review: false,
      updated_at: now
    },
    {
      user_id: "cust_002",
      status: "not_started",
      provider: "setu_digilocker",
      aadhaar_verified: false,
      dl_verified: false,
      needs_manual_review: false,
      updated_at: now
    }
  ],
  vehicleBlocks: [],
  vehicleLiveLocations: [
    {
      vehicle_id: "veh_001",
      latitude: 12.9716,
      longitude: 77.5946,
      speed_kmph: 28,
      heading_deg: 74,
      source: "seed_simulator",
      updated_at: now
    },
    {
      vehicle_id: "veh_002",
      latitude: 12.9352,
      longitude: 77.6245,
      speed_kmph: 42,
      heading_deg: 112,
      source: "seed_simulator",
      updated_at: now
    },
    {
      vehicle_id: "veh_003",
      latitude: 12.9989,
      longitude: 77.5926,
      speed_kmph: 0,
      heading_deg: 0,
      source: "seed_simulator",
      updated_at: now
    }
  ],
  damageIncidents: [],
  auditEvents: [],
  paymentOrders: [],
  paymentEvents: [],
  vehicleDocuments: [],
  notificationJobs: []
};
