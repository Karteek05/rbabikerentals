"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerApiRoutes = registerApiRoutes;
const adapter_1 = require("./adapter");
const adminBookings = __importStar(require("../api/admin/bookings/route"));
const adminBookingReject = __importStar(require("../api/admin/bookings/[id]/reject/route"));
const adminKycApprove = __importStar(require("../api/admin/kyc/[userId]/approve/route"));
const adminKycManualReview = __importStar(require("../api/admin/kyc/manual-review/route"));
const adminKycReject = __importStar(require("../api/admin/kyc/[userId]/reject/route"));
const adminTracking = __importStar(require("../api/admin/tracking/route"));
const adminVehicleImages = __importStar(require("../api/admin/vehicles/[id]/images/route"));
const adminVehicleById = __importStar(require("../api/admin/vehicles/[id]/route"));
const adminVehicles = __importStar(require("../api/admin/vehicles/route"));
const bookingCancel = __importStar(require("../api/bookings/[id]/cancel/route"));
const bookingDamage = __importStar(require("../api/bookings/[id]/damage/route"));
const bookingExtend = __importStar(require("../api/bookings/[id]/extend/route"));
const bookings = __importStar(require("../api/bookings/route"));
const customerBookings = __importStar(require("../api/customer/bookings/route"));
const documentExpiryJob = __importStar(require("../api/internal/jobs/document-expiry/route"));
const incidentEscalationJob = __importStar(require("../api/internal/jobs/incident-escalation/route"));
const trackingUpdate = __importStar(require("../api/internal/tracking/update/route"));
const kycByUser = __importStar(require("../api/kyc/[userId]/route"));
const digilockerCallback = __importStar(require("../api/kyc/digilocker/callback/route"));
const digilockerStart = __importStar(require("../api/kyc/digilocker/start/route"));
const digilockerStatus = __importStar(require("../api/kyc/digilocker/status/[requestId]/route"));
const mapsDistance = __importStar(require("../api/maps/distance/route"));
const mapsReverseGeocode = __importStar(require("../api/maps/reverse-geocode/route"));
const partnerRevenue = __importStar(require("../api/partner/revenue/route"));
const partnerTracking = __importStar(require("../api/partner/tracking/route"));
const paymentOrder = __importStar(require("../api/payments/order/route"));
const paymentRefund = __importStar(require("../api/payments/refund/route"));
const quotes = __importStar(require("../api/quotes/route"));
const vehicleBlock = __importStar(require("../api/vehicles/[id]/block/route"));
const razorpayWebhook = __importStar(require("../api/webhooks/razorpay/route"));
function registerApiRoutes(app) {
    app.post("/api/quotes", (0, adapter_1.adaptRoute)(quotes));
    app.post("/api/bookings", (0, adapter_1.adaptRoute)(bookings));
    app.post("/api/bookings/:id/extend", (0, adapter_1.adaptRoute)(bookingExtend));
    app.post("/api/bookings/:id/cancel", (0, adapter_1.adaptRoute)(bookingCancel));
    app.post("/api/bookings/:id/damage", (0, adapter_1.adaptRoute)(bookingDamage));
    app.get("/api/customer/bookings", (0, adapter_1.adaptRoute)(customerBookings));
    app.post("/api/kyc/digilocker/start", (0, adapter_1.adaptRoute)(digilockerStart));
    app.post("/api/kyc/digilocker/callback", (0, adapter_1.adaptRoute)(digilockerCallback));
    app.get("/api/kyc/digilocker/status/:requestId", (0, adapter_1.adaptRoute)(digilockerStatus));
    app.get("/api/kyc/:userId", (0, adapter_1.adaptRoute)(kycByUser));
    app.post("/api/payments/order", (0, adapter_1.adaptRoute)(paymentOrder));
    app.post("/api/payments/refund", (0, adapter_1.adaptRoute)(paymentRefund));
    app.post("/api/webhooks/razorpay", (0, adapter_1.adaptRoute)(razorpayWebhook));
    app.post("/api/maps/reverse-geocode", (0, adapter_1.adaptRoute)(mapsReverseGeocode));
    app.post("/api/maps/distance", (0, adapter_1.adaptRoute)(mapsDistance));
    app.get("/api/partner/revenue", (0, adapter_1.adaptRoute)(partnerRevenue));
    app.get("/api/partner/tracking", (0, adapter_1.adaptRoute)(partnerTracking));
    app.post("/api/vehicles/:id/block", (0, adapter_1.adaptRoute)(vehicleBlock));
    app.get("/api/admin/bookings", (0, adapter_1.adaptRoute)(adminBookings));
    app.post("/api/admin/bookings/:id/reject", (0, adapter_1.adaptRoute)(adminBookingReject));
    app.get("/api/admin/vehicles", (0, adapter_1.adaptRoute)(adminVehicles));
    app.post("/api/admin/vehicles", (0, adapter_1.adaptRoute)(adminVehicles));
    app.patch("/api/admin/vehicles/:id", (0, adapter_1.adaptRoute)(adminVehicleById));
    app.delete("/api/admin/vehicles/:id", (0, adapter_1.adaptRoute)(adminVehicleById));
    app.post("/api/admin/vehicles/:id/images", (0, adapter_1.adaptRoute)(adminVehicleImages));
    app.get("/api/admin/tracking", (0, adapter_1.adaptRoute)(adminTracking));
    app.get("/api/admin/kyc/manual-review", (0, adapter_1.adaptRoute)(adminKycManualReview));
    app.post("/api/admin/kyc/:userId/approve", (0, adapter_1.adaptRoute)(adminKycApprove));
    app.post("/api/admin/kyc/:userId/reject", (0, adapter_1.adaptRoute)(adminKycReject));
    app.post("/api/internal/tracking/update", (0, adapter_1.adaptRoute)(trackingUpdate));
    app.post("/api/internal/jobs/document-expiry", (0, adapter_1.adaptRoute)(documentExpiryJob));
    app.post("/api/internal/jobs/incident-escalation", (0, adapter_1.adaptRoute)(incidentEscalationJob));
}
