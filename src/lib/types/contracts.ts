import type { Booking, PricingQuote } from "@/lib/types/domain";

export interface QuoteRequest {
  user_id: string;
  vehicle_id: string;
  city: "bengaluru";
  duration_bucket: "hour" | "day" | "week" | "month";
  duration_value: number;
  extra_helmet_count?: number;
  coupon_code?: string;
}

export interface CreateBookingRequest {
  user_id: string;
  vehicle_id: string;
  city: "bengaluru";
  pickup_at: string;
  drop_at: string;
  pickup_zone?: string;
  pickup_address?: string;
  pickup_latitude?: number;
  pickup_longitude?: number;
  duration_bucket: "hour" | "day" | "week" | "month";
  duration_value: number;
  km_limit_bucket: "day" | "week" | "month";
  km_limit_value: number;
  extra_helmet_count?: number;
  coupon_code?: string;
  customer_profile?: BookingCustomerProfile;
}

export interface CreateBookingResponse {
  booking: Booking;
}

export interface BookingCustomerProfile {
  legal_name: string;
  email: string;
  mobile: string;
  pan_number?: string;
  date_of_birth?: string;
  cibil_consent?: boolean;
}

export interface ExtendBookingRequest {
  requested_drop_at: string;
  duration_bucket: "hour" | "day";
  duration_value: number;
}

export interface CancelBookingRequest {
  reason: string;
}

export interface RevenueResponse {
  totals: {
    booking_count: number;
    gross_revenue: number;
    pending_revenue: number;
    completed_revenue: number;
  };
  booking_wise: Array<{
    booking_id: string;
    vehicle_id: string;
    status: string;
    total_payable: number;
  }>;
  vehicle_wise: Array<{
    vehicle_id: string;
    vehicle_label: string;
    registration_number: string | null;
    booking_count: number;
    revenue: number;
  }>;
  period_wise: {
    weekly: Array<{ week: string; revenue: number }>;
    monthly: Array<{ month: string; revenue: number }>;
  };
}

export interface BlockVehicleRequest {
  starts_at: string;
  ends_at: string;
  reason: string;
}

export interface RejectBookingRequest {
  reason: string;
}

export interface ApproveBookingRequest {
  note?: string;
}

export interface AssignBookingVehicleRequest {
  assigned_vehicle_id: string;
}


export interface ApiSuccess<T> {
  ok: true;
  data: T;
}

export interface ApiError {
  ok: false;
  error: {
    code: string;
    message: string;
  };
}

export interface ExtensionResponse {
  booking_id: string;
  status: string;
  additional_quote: PricingQuote;
}

export interface CreatePaymentOrderRequest {
  booking_id: string;
}

export interface ConfirmPaymentRequest {
  booking_id: string;
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export interface RefundPaymentRequest {
  booking_id: string;
  /** Amount in paise (INR × 100). Omit to refund the remaining balance on the latest order. */
  amount?: number;
  reason?: string;
}

export interface MapsReverseGeocodeRequest {
  latitude: number;
  longitude: number;
}

export interface MapsDistanceRequest {
  origin: {
    latitude: number;
    longitude: number;
  };
  destination: {
    latitude: number;
    longitude: number;
  };
  mode?: "driving" | "walking" | "bicycling" | "transit";
}

export interface ReportDamageRequest {
  description: string;
  photo_urls: string[];
}

export interface UpdateVehicleTrackingRequest {
  vehicle_id: string;
  latitude: number;
  longitude: number;
  speed_kmph?: number;
  heading_deg?: number;
  source?: string;
}

export interface AdminVehicleUpsertRequest {
  owner_id: string;
  city?: "bengaluru";
  category: "scooter" | "bike" | "ev_bike";
  brand: string;
  model: string;
  registration_number?: string;
  chassis_number?: string;
  is_active?: boolean;
  deposit_amount: number;
  rate_per_hour: number;
  rate_per_day: number;
  rate_per_week: number;
  rate_per_month: number;
  included_km_per_hour: number;
  included_km_per_day: number;
  included_km_per_week: number;
  included_km_per_month: number;
  excess_km_rate: number;
  image_urls?: string[];
}

export interface AdminVehicleUpdateRequest {
  owner_id?: string;
  city?: "bengaluru";
  category?: "scooter" | "bike" | "ev_bike";
  brand?: string;
  model?: string;
  registration_number?: string;
  chassis_number?: string;
  is_active?: boolean;
  deposit_amount?: number;
  rate_per_hour?: number;
  rate_per_day?: number;
  rate_per_week?: number;
  rate_per_month?: number;
  included_km_per_hour?: number;
  included_km_per_day?: number;
  included_km_per_week?: number;
  included_km_per_month?: number;
  excess_km_rate?: number;
  image_urls?: string[];
  catalog_vehicle_id?: string | null;
}
export interface AdminVehicleImageRequest {
  image_url: string;
}

export interface PartnerApplyRequest {
  name?: string;
  phone?: string;
  message?: string;
}

export interface RejectPartnerApplicationRequest {
  reason?: string;
}
