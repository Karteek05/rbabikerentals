import { getCouponDiscountRate, getOperationalPolicy, getVehicleOrThrow } from "@/lib/data/repository";
import type { PricingQuote, Vehicle } from "@/lib/types/domain";
import type { QuoteRequest } from "@/lib/types/contracts";
import { ApiException } from "@/lib/utils/errors";
import type { MileagePricingDefaults } from "@/lib/pricing/defaults";
import { getDefaultMileagePricing } from "@/lib/pricing/defaults";

const GST_RATE = 0.18;
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const WEEK_MS = 7 * DAY_MS;
const MONTH_MS = 30 * DAY_MS;
const HELMET_RATE = {
  hour: 50,
  day: 50,
  week: 50,
  month: 50
} as const;


export function resolveDurationValueFromWindow(params: {
  duration_bucket: QuoteRequest["duration_bucket"];
  start_at: string;
  end_at: string;
}) {
  const start = new Date(params.start_at).getTime();
  const end = new Date(params.end_at).getTime();

  if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) {
    throw new ApiException(
      400,
      "invalid_booking_window",
      "Pickup time must be before drop time."
    );
  }

  const bucketMs = {
    hour: HOUR_MS,
    day: DAY_MS,
    week: WEEK_MS,
    month: MONTH_MS
  }[params.duration_bucket];

  const durationMs = end - start;
  if (durationMs % bucketMs !== 0) {
    throw new ApiException(
      400,
      "duration_window_mismatch",
      "Selected duration plan does not match the requested booking window."
    );
  }

  return durationMs / bucketMs;
}

function durationDays(
  bucket: QuoteRequest["duration_bucket"],
  count: number
) {
  if (bucket === "hour") return count / 24;
  if (bucket === "day") return count;
  if (bucket === "week") return count * 7;
  return count * 30;
}

export function resolveListDailyRate(vehicle: Pick<Vehicle, "rate_per_hour" | "rate_per_week">) {
  if (vehicle.rate_per_hour > 0) {
    return vehicle.rate_per_hour * 24;
  }
  return vehicle.rate_per_week / 7;
}

function resolvePackageBaseAmount(
  vehicle: Vehicle,
  bucket: QuoteRequest["duration_bucket"],
  count: number
) {
  let baseRate = 0;
  if (bucket === "hour") baseRate = vehicle.rate_per_hour;
  if (bucket === "day") baseRate = vehicle.rate_per_day;
  if (bucket === "week") baseRate = vehicle.rate_per_week;
  if (bucket === "month") baseRate = vehicle.rate_per_month;
  if (!baseRate) {
    throw new ApiException(400, "invalid_duration_bucket", "Unsupported duration bucket.");
  }

  let baseAmount = baseRate * count;
  if (bucket === "day" && count === 15) {
    baseAmount = vehicle.rate_per_day;
  }
  return baseAmount;
}

function splitInclusiveGst(taxAmount: number) {
  const cgstAmount = Math.round(taxAmount / 2);
  return {
    cgst_amount: cgstAmount,
    sgst_amount: taxAmount - cgstAmount
  };
}

export function buildPricingQuoteFromVehicle(
  vehicle: Vehicle,
  input: Pick<QuoteRequest, "duration_bucket" | "duration_value" | "extra_helmet_count" | "coupon_code">,
  configuredCouponRate?: number
): PricingQuote {
  const bucket = input.duration_bucket;
  const count = input.duration_value;

  if (!Number.isInteger(count) || count <= 0) {
    throw new ApiException(
      400,
      "invalid_duration_value",
      "duration_value must be a positive integer."
    );
  }
  if (
    input.extra_helmet_count !== undefined &&
    (!Number.isInteger(input.extra_helmet_count) || input.extra_helmet_count < 0)
  ) {
    throw new ApiException(
      400,
      "invalid_extra_helmet_count",
      "extra_helmet_count must be a non-negative integer."
    );
  }

  const baseAmount = resolvePackageBaseAmount(vehicle, bucket, count);
  const durationAmount = 0;
  const addonAmount =
    (input.extra_helmet_count ?? 0) * HELMET_RATE[bucket] * count;
  const discountRate = configuredCouponRate ?? 0;
  const couponDiscount = Math.round((baseAmount + addonAmount) * discountRate);
  const depositAmount = vehicle.deposit_amount;
  const taxableInclusive = Math.max(0, baseAmount + durationAmount + addonAmount - couponDiscount);
  const taxAmount = Math.round(taxableInclusive - taxableInclusive / (1 + GST_RATE));
  const totalPayable = taxableInclusive + depositAmount;
  const { cgst_amount, sgst_amount } = splitInclusiveGst(taxAmount);

  const vehicleRentalCost = Math.round(
    resolveListDailyRate(vehicle) * durationDays(bucket, count)
  );
  const planDiscount = Math.max(0, vehicleRentalCost - baseAmount);
  const mileageDefaults = getDefaultMileagePricing(vehicle.category);
  const kmIncluded = estimateKmIncluded(
    vehicle,
    bucket,
    count,
    mileageDefaults
  );
  const excessKmRate = vehicle.excess_km_rate ?? mileageDefaults.excess_km_rate;

  return {
    vehicle_rental_cost: vehicleRentalCost,
    plan_discount: planDiscount,
    base_amount: baseAmount,
    duration_amount: durationAmount,
    addon_amount: addonAmount,
    coupon_discount: couponDiscount,
    deposit_amount: depositAmount,
    cgst_amount,
    sgst_amount,
    tax_amount: taxAmount,
    total_cost: taxableInclusive,
    total_payable: totalPayable,
    km_included: kmIncluded,
    excess_km_rate: excessKmRate
  };
}

export async function computePricingQuote(input: QuoteRequest): Promise<PricingQuote> {
  const vehicle = await getVehicleOrThrow(input.vehicle_id);
  const discount = input.coupon_code ? await getCouponDiscountRate(input.coupon_code) : 0;
  return buildPricingQuoteFromVehicle(vehicle, input, discount);
}
export async function computeCancellationBreakup(params: { totalPayable: number; pickupAt: string }) {
  const policy = await getOperationalPolicy();
  const hoursToPickup = (new Date(params.pickupAt).getTime() - Date.now()) / (1000 * 60 * 60);
  const chargeRate = (hoursToPickup >= 24 ? policy.cancellation_over_24h_percent : policy.cancellation_under_24h_percent) / 100;
  const cancellationCharge = Math.round(params.totalPayable * chargeRate);
  const refundAmount = Math.max(0, params.totalPayable - cancellationCharge);
  return { charge_rate: chargeRate, cancellation_charge: cancellationCharge, refund_amount: refundAmount };
}

function estimateKmIncluded(
  vehicle: Vehicle,
  bucket: "hour" | "day" | "week" | "month",
  count: number,
  defaults: MileagePricingDefaults
) {
  const perRental =
    bucket === "hour"
      ? vehicle.included_km_per_hour ?? defaults.included_km_per_hour
      : bucket === "day"
        ? vehicle.included_km_per_day ?? defaults.included_km_per_day
        : bucket === "week"
          ? vehicle.included_km_per_week ?? defaults.included_km_per_week
          : vehicle.included_km_per_month ?? defaults.included_km_per_month;
  return perRental * count;
}

export function mergePricingQuotes(left: PricingQuote, right: PricingQuote): PricingQuote {
  return {
    vehicle_rental_cost: (left.vehicle_rental_cost ?? 0) + (right.vehicle_rental_cost ?? 0),
    plan_discount: (left.plan_discount ?? 0) + (right.plan_discount ?? 0),
    base_amount: left.base_amount + right.base_amount,
    duration_amount: left.duration_amount + right.duration_amount,
    addon_amount: left.addon_amount + right.addon_amount,
    coupon_discount: left.coupon_discount + right.coupon_discount,
    deposit_amount: left.deposit_amount + right.deposit_amount,
    cgst_amount: (left.cgst_amount ?? 0) + (right.cgst_amount ?? 0),
    sgst_amount: (left.sgst_amount ?? 0) + (right.sgst_amount ?? 0),
    tax_amount: left.tax_amount + right.tax_amount,
    total_cost: (left.total_cost ?? left.total_payable - left.deposit_amount) +
      (right.total_cost ?? right.total_payable - right.deposit_amount),
    total_payable: left.total_payable + right.total_payable,
    km_included: left.km_included + right.km_included,
    excess_km_rate: right.excess_km_rate
  };
}

