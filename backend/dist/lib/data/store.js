"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.store = void 0;
const now = new Date().toISOString();
exports.store = {
    users: [
        {
            id: "cust_001",
            name: "Rahul Customer",
            role: "customer",
            city: "bengaluru",
            kyc_status: "verified"
        },
        {
            id: "cust_002",
            name: "Asha Customer",
            role: "customer",
            city: "bengaluru",
            kyc_status: "not_started"
        },
        {
            id: "partner_001",
            name: "Nikhil Fleet Partner",
            role: "partner_investor",
            city: "bengaluru",
            kyc_status: "verified"
        },
        {
            id: "admin_001",
            name: "RBA Admin",
            role: "admin",
            city: "bengaluru",
            kyc_status: "verified"
        }
    ],
    vehicles: [
        {
            id: "veh_001",
            owner_id: "partner_001",
            city: "bengaluru",
            category: "scooter",
            brand: "Honda",
            model: "Activa 6G",
            image_urls: ["/images/services/activa-6g.svg"],
            is_active: true,
            deposit_amount: 2000,
            rate_per_hour: 120,
            rate_per_day: 750,
            rate_per_week: 4200,
            rate_per_month: 15000
        },
        {
            id: "veh_002",
            owner_id: "partner_001",
            city: "bengaluru",
            category: "bike",
            brand: "Yamaha",
            model: "MT-15",
            image_urls: ["/images/services/access-125.svg"],
            is_active: true,
            deposit_amount: 3000,
            rate_per_hour: 180,
            rate_per_day: 1200,
            rate_per_week: 7000,
            rate_per_month: 25000
        },
        {
            id: "veh_003",
            owner_id: "partner_001",
            city: "bengaluru",
            category: "ev_bike",
            brand: "TVS",
            model: "iQube",
            image_urls: ["/images/services/access-125.svg"],
            is_active: true,
            deposit_amount: 2500,
            rate_per_hour: 140,
            rate_per_day: 900,
            rate_per_week: 5000,
            rate_per_month: 17000
        }
    ],
    bookings: [],
    kycRecords: [
        {
            user_id: "cust_001",
            status: "verified",
            provider: "setu_digilocker",
            aadhaar_verified: true,
            dl_verified: true,
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
