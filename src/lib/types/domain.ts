export type Role = "customer" | "partner_investor" | "admin";

export type KycStatus =
  | "not_started"
  | "in_progress"
  | "verified"
  | "manual_review"
  | "failed"
  | "expired";

export type BookingStatus =
  | "draft"
  | "pending_kyc"
  | "admin_review"
  | "payment_pending"
  | "confirmed"
  | "ongoing"
  | "extension_requested"
  | "extended"
  | "completed"
  | "cancelled";

export interface PricingQuote {
  base_amount: number;
  duration_amount: number;
  addon_amount: number;
  coupon_discount: number;
  deposit_amount: number;
  tax_amount: number;
  total_payable: number;
  km_included: number;
  excess_km_rate: number;
}

export interface User {
  id: string;
  name: string;
  role: Role;
  city: "bengaluru";
  kyc_status: KycStatus;
  email?: string | null;
  phone?: string | null;
  pan_number?: string | null;
  date_of_birth?: string | null;
  cibil_consent_at?: string | null;
  deleted_at?: string | null;
}

export interface Vehicle {
  id: string;
  owner_id: string;
  city: "bengaluru";
  category: "scooter" | "bike" | "ev_bike";
  brand: string;
  model: string;
  image_urls?: string[];
  is_active: boolean;
  deposit_amount: number;
  rate_per_hour: number;
  rate_per_day: number;
  rate_per_week: number;
  rate_per_month: number;
}

export interface VehicleLiveLocation {
  vehicle_id: string;
  latitude: number;
  longitude: number;
  speed_kmph?: number | null;
  heading_deg?: number | null;
  source: string;
  updated_at: string;
}

export interface Booking {
  id: string;
  user_id: string;
  vehicle_id: string;
  city: "bengaluru";
  status: BookingStatus;
  pickup_at: string;
  drop_at: string;
  pickup_zone?: string | null;
  pickup_address?: string | null;
  pickup_latitude?: number | null;
  pickup_longitude?: number | null;
  quote: PricingQuote;
  coupon_code?: string;
  km_limit_bucket: "day" | "week" | "month";
  km_limit_value: number;
  cancel_reason?: string;
  created_at: string;
  updated_at: string;
}

export interface BookingExtension {
  booking_id: string;
  requested_drop_at: string;
  additional_quote: PricingQuote;
}

export interface VehicleBlockWindow {
  id: string;
  vehicle_id: string;
  starts_at: string;
  ends_at: string;
  reason: string;
  created_by: string;
  created_at: string;
}

export interface DamageIncident {
  id: string;
  booking_id: string;
  vehicle_id: string;
  reported_by: string;
  description: string;
  photo_urls: string[];
  created_at: string;
}

export interface KycRecord {
  user_id: string;
  status: KycStatus;
  provider: "setu_digilocker";
  request_id?: string;
  reference_id?: string;
  consent_scopes?: string[];
  aadhaar_verified: boolean;
  dl_verified: boolean;
  cibil_score?: number | null;
  cibil_risk_band?: "low" | "medium" | "high" | "unknown" | null;
  cibil_checked_at?: string | null;
  pan_last4?: string | null;
  needs_manual_review: boolean;
  failure_reason?: string;
  updated_at: string;
}

export interface AuditEvent {
  id: string;
  actor_id: string;
  actor_role: Role;
  action: string;
  resource_type: string;
  resource_id: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface PaymentOrder {
  id: string;
  booking_id: string;
  provider: "razorpay";
  provider_order_id: string;
  provider_payment_id?: string | null;
  provider_refund_id?: string | null;
  amount: number;
  refunded_amount?: number | null;
  currency: "INR";
  status: "created" | "paid" | "failed" | "refunded";
  created_at: string;
  updated_at: string;
}

export interface PaymentEvent {
  id: string;
  provider: "razorpay";
  provider_event_id: string;
  payload_hash: string;
  created_at: string;
}

export interface VehicleDocument {
  id: string;
  vehicle_id: string;
  doc_type: "rc" | "road_tax" | "permit" | "insurance" | "puc" | "service";
  file_url: string;
  expires_at: string;
  created_at: string;
  updated_at: string;
}

export interface NotificationJob {
  id: string;
  channel: "sms" | "whatsapp" | "email" | "in_app";
  template_key: string;
  recipient: string;
  payload: Record<string, unknown>;
  status: "queued" | "sent" | "failed";
  created_at: string;
}
