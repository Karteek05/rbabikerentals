"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveDurationValueFromWindow = resolveDurationValueFromWindow;
exports.computePricingQuote = computePricingQuote;
exports.computeCancellationBreakup = computeCancellationBreakup;
const repository_1 = require("../../lib/data/repository");
const errors_1 = require("../../lib/utils/errors");
const GST_RATE = 0.18;
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const WEEK_MS = 7 * DAY_MS;
const MONTH_MS = 30 * DAY_MS;
const HELMET_RATE = {
    hour: 20,
    day: 80,
    week: 420,
    month: 1400
};
const couponRules = {
    WELCOME5: 0.05,
    BENGALURU10: 0.1,
    WEEKEND15: 0.15
};
function resolveDurationValueFromWindow(params) {
    const start = new Date(params.start_at).getTime();
    const end = new Date(params.end_at).getTime();
    if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) {
        throw new errors_1.ApiException(400, "invalid_booking_window", "Pickup time must be before drop time.");
    }
    const bucketMs = {
        hour: HOUR_MS,
        day: DAY_MS,
        week: WEEK_MS,
        month: MONTH_MS
    }[params.duration_bucket];
    const durationMs = end - start;
    if (durationMs % bucketMs !== 0) {
        throw new errors_1.ApiException(400, "duration_window_mismatch", "Selected duration plan does not match the requested booking window.");
    }
    return durationMs / bucketMs;
}
async function computePricingQuote(input) {
    const vehicle = await (0, repository_1.getVehicleOrThrow)(input.vehicle_id);
    const bucket = input.duration_bucket;
    const count = input.duration_value;
    if (!Number.isInteger(count) || count <= 0) {
        throw new errors_1.ApiException(400, "invalid_duration_value", "duration_value must be a positive integer.");
    }
    if (input.extra_helmet_count !== undefined &&
        (!Number.isInteger(input.extra_helmet_count) || input.extra_helmet_count < 0)) {
        throw new errors_1.ApiException(400, "invalid_extra_helmet_count", "extra_helmet_count must be a non-negative integer.");
    }
    let baseRate = 0;
    if (bucket === "hour")
        baseRate = vehicle.rate_per_hour;
    if (bucket === "day")
        baseRate = vehicle.rate_per_day;
    if (bucket === "week")
        baseRate = vehicle.rate_per_week;
    if (bucket === "month")
        baseRate = vehicle.rate_per_month;
    if (!baseRate) {
        throw new errors_1.ApiException(400, "invalid_duration_bucket", "Unsupported duration bucket.");
    }
    const baseAmount = baseRate * count;
    const durationAmount = 0;
    const addonAmount = (input.extra_helmet_count ?? 0) * HELMET_RATE[bucket] * count;
    const normalizedCouponCode = input.coupon_code?.trim().toUpperCase();
    const discountRate = normalizedCouponCode ? couponRules[normalizedCouponCode] ?? 0 : 0;
    const couponDiscount = Math.round((baseAmount + addonAmount) * discountRate);
    const depositAmount = vehicle.deposit_amount;
    const taxable = Math.max(0, baseAmount + durationAmount + addonAmount - couponDiscount);
    const taxAmount = Math.round(taxable * GST_RATE);
    const totalPayable = taxable + taxAmount + depositAmount;
    const kmIncluded = estimateKmIncluded(bucket, count);
    const excessKmRate = excessKmRateByCategory(vehicle.category);
    return {
        base_amount: baseAmount,
        duration_amount: durationAmount,
        addon_amount: addonAmount,
        coupon_discount: couponDiscount,
        deposit_amount: depositAmount,
        tax_amount: taxAmount,
        total_payable: totalPayable,
        km_included: kmIncluded,
        excess_km_rate: excessKmRate
    };
}
function estimateKmIncluded(bucket, count) {
    if (bucket === "hour")
        return 10 * count;
    if (bucket === "day")
        return 120 * count;
    if (bucket === "week")
        return 900 * count;
    return 3000 * count;
}
function excessKmRateByCategory(category) {
    if (category === "scooter")
        return 5;
    if (category === "bike")
        return 7;
    return 6;
}
function computeCancellationBreakup(params) {
    const now = Date.now();
    const pickup = new Date(params.pickupAt).getTime();
    const hoursToPickup = (pickup - now) / (1000 * 60 * 60);
    const chargeRate = hoursToPickup >= 24 ? 0.1 : 0.3;
    const cancellationCharge = Math.round(params.totalPayable * chargeRate);
    const refundAmount = Math.max(0, params.totalPayable - cancellationCharge);
    return {
        charge_rate: chargeRate,
        cancellation_charge: cancellationCharge,
        refund_amount: refundAmount
    };
}
