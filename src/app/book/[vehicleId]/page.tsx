"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Icon from "../../components/Icon";
import BookingScheduleFields from "../../components/BookingScheduleFields";
import LoginPromptModal from "../../components/LoginPromptModal";
import BookingFeedbackModal from "../../components/BookingFeedbackModal";
import CostBreakdown from "../../components/CostBreakdown";
import { authClient } from "@/lib/auth/auth-client";
import { buildPricingQuoteFromVehicle } from "@/lib/pricing/engine";
import {
  GST_INCLUSIVE_COPY,
  PACKAGE_PLANS,
  PUBLIC_FLEET_BY_ID,
  getPackageRate,
  type PackageRateKey
} from "@/lib/fleet/catalog";
import { usePublicFleet } from "@/lib/fleet/use-public-fleet";
import {
  durationParamToPackageKey,
  getPackageHours,
  resolveBookingScheduleFromParams
} from "@/lib/bookings/schedule";
import {
  buildInitialScheduleParts,
  fromDateTimeParts,
  isoToScheduleParts,
  nearestTimeSlot,
  toDateTimeIso,
  toDateValue
} from "@/lib/datetime/booking-schedule-ui";

import type { PricingQuote } from "@/lib/types/domain";

const API_HEADERS = {
  "Content-Type": "application/json"
};

const fetchOptions = {
  credentials: "include" as const,
  headers: API_HEADERS
};

const PACKAGE_TO_BUCKET: Record<PackageRateKey, "day" | "week" | "month"> = {
  rate_per_week: "week",
  rate_per_day: "day",
  rate_per_month: "month"
};

const PACKAGE_TO_VALUE: Record<PackageRateKey, number> = {
  rate_per_week: 1,
  rate_per_day: 15,
  rate_per_month: 1
};


function rupees(value: number) {
  return `Rs. ${value.toLocaleString("en-IN")}`;
}

function formatScheduleTime(value: string) {
  return new Date(value).toLocaleString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function getBookingErrorMessage(
  status: number,
  error?: { code?: string; message?: string }
) {
  if (error?.code === "vehicle_unavailable") {
    return "No units are left for this vehicle in the selected dates. Please change dates or choose another vehicle.";
  }
  if (error?.code === "vehicle_blocked") {
    return "This vehicle is blocked for maintenance during the selected window. Please change dates or choose another vehicle.";
  }
  if (error?.code === "auth_required") {
    return "Please sign in again before submitting the booking request.";
  }
  if (status >= 500) {
    return "The booking service had a problem. Please try again in a moment.";
  }
  return error?.message ?? "Booking failed.";
}

export default function BookPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryString = searchParams.toString();
  const { data: session } = authClient.useSession();
  const publicFleet = usePublicFleet();
  const vehicleId = typeof params.vehicleId === "string" ? params.vehicleId : "";
  const vehicle = publicFleet.find((item) => item.id === vehicleId) ?? PUBLIC_FLEET_BY_ID[vehicleId];
  const initialPackageKey = durationParamToPackageKey(searchParams.get("duration"));
  const initialSchedule = resolveBookingScheduleFromParams(
    searchParams,
    initialPackageKey
  );
  const initialPickup = isoToScheduleParts(initialSchedule.pickupAt);
  const initialDrop = isoToScheduleParts(initialSchedule.dropAt);

  const [packageKey, setPackageKey] = useState<PackageRateKey>(initialPackageKey);
  const [pickupDate, setPickupDate] = useState(initialPickup.dateValue);
  const [pickupTime, setPickupTime] = useState(initialPickup.timeValue);
  const [dropDate, setDropDate] = useState(initialDrop.dateValue);
  const [dropTime, setDropTime] = useState(initialDrop.timeValue);
  const [unitsAvailable, setUnitsAvailable] = useState<number | null>(null);
  const [extraHelmet, setExtraHelmet] = useState(false);
  const [coupon, setCoupon] = useState("");
  const [pickupZone, setPickupZone] = useState(initialSchedule.pickupZone);
  const [pickupAddress, setPickupAddress] = useState("");
  const [legalName, setLegalName] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [quote, setQuote] = useState<PricingQuote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    title: string;
    message: string;
    bookingId?: string;
  } | null>(null);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [locations, setLocations] = useState<Array<{ id: string; name: string; active: boolean }>>([]);
  const [locationsLoading, setLocationsLoading] = useState(true);
  const [locationsError, setLocationsError] = useState<string | null>(null);
  const [cancellationPolicy, setCancellationPolicy] = useState<{
    cancellation_over_24h_percent: number;
    cancellation_under_24h_percent: number;
  } | null>(null);
  const [policyLoading, setPolicyLoading] = useState(true);
  const dropManuallyEdited = useRef(false);

  const isSignedIn = Boolean(session?.user?.id);
  const returnPath = useMemo(() => {
    const params = searchParams.toString();
    return params ? `/book/${vehicleId}?${params}` : `/book/${vehicleId}`;
  }, [searchParams, vehicleId]);

  const durationBucket = PACKAGE_TO_BUCKET[packageKey];
  const durationValue = PACKAGE_TO_VALUE[packageKey];

  const estimatedQuote = useMemo<PricingQuote | null>(() => {
    if (!vehicle) return null;
    return buildPricingQuoteFromVehicle(
      {
        id: vehicle.id,
        owner_id: "public",
        city: vehicle.city,
        category: vehicle.category,
        brand: vehicle.brand,
        model: vehicle.model,
        is_active: vehicle.is_active,
        deposit_amount: vehicle.deposit_amount,
        rate_per_hour: vehicle.rate_per_hour,
        rate_per_day: vehicle.rate_per_day,
        rate_per_week: vehicle.rate_per_week,
        rate_per_month: vehicle.rate_per_month,
        included_km_per_hour: vehicle.included_km_per_hour,
        included_km_per_day: vehicle.included_km_per_day,
        included_km_per_week: vehicle.included_km_per_week,
        included_km_per_month: vehicle.included_km_per_month,
        excess_km_rate: vehicle.excess_km_rate
      },
      {
        duration_bucket: durationBucket,
        duration_value: durationValue,
        extra_helmet_count: extraHelmet ? 1 : 0
      }
    );
  }, [vehicle, durationBucket, durationValue, extraHelmet]);

  const displayQuote = quote ?? (isSignedIn ? null : estimatedQuote);

  const pickupAt = toDateTimeIso(pickupDate, pickupTime);
  const dropAt = toDateTimeIso(dropDate, dropTime);
  const scheduleValid = fromDateTimeParts(dropDate, dropTime).getTime() > fromDateTimeParts(pickupDate, pickupTime).getTime();

  useEffect(() => {
    const nextPackageKey = durationParamToPackageKey(searchParams.get("duration"));
    const nextSchedule = resolveBookingScheduleFromParams(searchParams, nextPackageKey);
    const nextPickup = isoToScheduleParts(nextSchedule.pickupAt);
    const nextDrop = isoToScheduleParts(nextSchedule.dropAt);
    setPackageKey(nextPackageKey);
    setPickupZone(nextSchedule.pickupZone);
    setPickupDate(nextPickup.dateValue);
    setPickupTime(nextPickup.timeValue);
    setDropDate(nextDrop.dateValue);
    setDropTime(nextDrop.timeValue);
    dropManuallyEdited.current = false;
    setBookingError(null);
  }, [queryString, searchParams]);
  useEffect(() => {
    let active = true;
    fetch("/api/locations", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((json) => {
        if (!active) return;
        if (!json?.ok || !Array.isArray(json.data?.items)) {
          setLocationsError("Pickup locations are unavailable right now.");
          return;
        }
        const next = json.data.items.filter((item: { active: boolean }) => item.active);
        setLocations(next);
        if (!next.some((item: { name: string }) => item.name === pickupZone)) {
          const nextLocation = next[0]?.name ?? "";
          setPickupZone(nextLocation);
          const nextParams = new URLSearchParams(searchParams.toString());
          if (nextLocation) nextParams.set("pickup_location", nextLocation);
          else nextParams.delete("pickup_location");
          router.replace(`/book/${vehicleId}${nextParams.size ? `?${nextParams.toString()}` : ""}`, { scroll: false });
        }
      })
      .catch(() => { if (active) setLocationsError("Could not load pickup locations. Please try again."); })
      .finally(() => { if (active) setLocationsLoading(false); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    let active = true;
    fetch("/api/policies", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((json) => {
        const policy = json?.data;
        const values = [
          policy?.cancellation_over_24h_percent,
          policy?.cancellation_under_24h_percent
        ];
        if (
          active &&
          json?.ok &&
          values.every((value) => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100)
        ) {
          setCancellationPolicy({
            cancellation_over_24h_percent: values[0],
            cancellation_under_24h_percent: values[1]
          });
        }
      })
      .catch(() => undefined)
      .finally(() => { if (active) setPolicyLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (dropManuallyEdited.current) return;
    const pickupAtDate = fromDateTimeParts(pickupDate, pickupTime);
    const nextDrop = new Date(pickupAtDate.getTime() + getPackageHours(packageKey) * 3_600_000);
    setDropDate(toDateValue(nextDrop));
    setDropTime(nearestTimeSlot(nextDrop));
  }, [packageKey, pickupDate, pickupTime]);

  useEffect(() => {
    if (!vehicleId || !scheduleValid) return;
    const params = new URLSearchParams({
      duration: packageKey === "rate_per_month" ? "monthly" : packageKey === "rate_per_day" ? "fortnight" : "weekly",
      pickup_at: pickupAt,
      drop_at: dropAt,
      pickup_location: pickupZone
    });
    fetch(`/api/fleet/availability?${params.toString()}`, { credentials: "include" })
      .then((res) => res.json())
      .then((json) => {
        const item = json?.data?.items?.find((entry: { vehicle_id: string }) => entry.vehicle_id === vehicleId);
        setUnitsAvailable(item?.available_units ?? null);
      })
      .catch(() => setUnitsAvailable(null));
  }, [vehicleId, pickupAt, dropAt, packageKey, scheduleValid]);

  const fetchQuote = useCallback(async () => {
    if (!vehicle || !session?.user?.id) return;
    setQuoteLoading(true);
    setQuoteError(null);
    try {
      const res = await fetch("/api/quotes", {
        method: "POST",
        ...fetchOptions,
        body: JSON.stringify({
          user_id: session?.user?.id,
          vehicle_id: vehicleId,
          city: "bengaluru",
          duration_bucket: durationBucket,
          duration_value: durationValue,
          extra_helmet_count: extraHelmet ? 1 : 0,
          coupon_code: coupon || undefined
        })
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setQuoteError(json?.error?.message ?? "Could not fetch quote");
        setQuote(null);
      } else {
        setQuote(json.data);
      }
    } catch {
      setQuoteError("Network error fetching quote");
      setQuote(null);
    } finally {
      setQuoteLoading(false);
    }
  }, [coupon, durationBucket, durationValue, extraHelmet, vehicle, vehicleId, session?.user?.id]);

  useEffect(() => {
    const timer = setTimeout(fetchQuote, 250);
    return () => clearTimeout(timer);
  }, [fetchQuote]);

  async function handleReserve() {
    if (!session?.user?.id) {
      setBookingError(null);
      setShowLoginPrompt(true);
      return;
    }

    if (!pickupZone || !locations.some((location) => location.name === pickupZone)) {
      setBookingError("Choose an active pickup location.");
      return;
    }

    if (!legalName.trim() || !profileEmail.trim() || !mobile.trim()) {
      setBookingError("Name, email, and mobile are required.");
      return;
    }

    setBookingLoading(true);
    setBookingError(null);

    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        ...fetchOptions,
        body: JSON.stringify({
          user_id: session?.user?.id,
          vehicle_id: vehicleId,
          city: "bengaluru",
          pickup_at: pickupAt,
          drop_at: dropAt,
          pickup_zone: pickupZone,
          pickup_address: pickupAddress || pickupZone,
          duration_bucket: durationBucket,
          duration_value: durationValue,
          km_limit_bucket: durationBucket,
          km_limit_value: quote?.km_included ?? 0,
          extra_helmet_count: extraHelmet ? 1 : 0,
          coupon_code: coupon || undefined,
          customer_profile: {
            legal_name: legalName,
            email: profileEmail,
            mobile
          }
        })
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        const message = getBookingErrorMessage(res.status, json?.error);
        setBookingError(message);
        setFeedback({
          type: "error",
          title: "Booking not submitted",
          message
        });
      } else {
        const newBookingId = json.data.booking.id as string;
        setBookingError(null);
        setFeedback({
          type: "success",
          title: "Request submitted",
          message:
            "We received your booking request. We’ll confirm availability and share payment details soon.",
          bookingId: newBookingId
        });
      }
    } catch {
      const message =
        "Could not reach the booking service. Check that the site is running and try again.";
      setBookingError(message);
      setFeedback({
        type: "error",
        title: "Booking not submitted",
        message
      });
    } finally {
      setBookingLoading(false);
    }
  }

  if (!vehicle) {
    return (
      <div className="mx-auto max-w-container px-4 py-24 text-center sm:px-6">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-black/5">
          <Icon name="search" className="h-8 w-8 text-black/60" />
        </div>
        <h1 className="mb-2 text-3xl font-bold">Vehicle not found</h1>
        <p className="mb-6 text-uber-body-gray">This vehicle isn’t available for booking.</p>
        <a href="/browse" className="btn-primary">
          Back to Browse
        </a>
      </div>
    );
  }

  const vehicleType = vehicle.category === "scooter" ? "scooter" : vehicle.category === "ev_bike" ? "electric bike" : "bike";

  return (
    <div className="min-h-screen bg-white">
      <div className="border-b border-black/10">
        <div className="mx-auto max-w-container px-4 py-4 text-sm text-uber-body-gray sm:px-6">
          <a href="/browse" className="transition-colors hover:text-black">
            Back to Browse
          </a>
          <span className="mx-2">/</span>
          <span className="font-medium text-black">
            {vehicle.brand} {vehicle.model}
          </span>
        </div>
      </div>

      <div className="mx-auto max-w-container px-4 py-8 sm:px-6 sm:py-10">
        <div className="grid gap-10 lg:grid-cols-[1fr_420px]">
          <div>
            <div className="mb-8 overflow-hidden rounded-xl bg-uber-chip-gray">
              <img
                src={vehicle.image}
                alt={vehicle.imageAlt}
                className="h-full max-h-[430px] w-full object-contain"
                onError={(event) => {
                  event.currentTarget.src = vehicle.fallbackImage;
                }}
              />
            </div>

            <h1 className="mb-1 text-4xl font-bold">
              {vehicle.brand} {vehicle.model}
            </h1>
            <p className="mb-6 text-uber-body-gray capitalize">{vehicleType} - {vehicle.engine}</p>


            <h2 className="mb-4 text-xl font-bold">Pricing</h2>
            <div className="card divide-y divide-black/5">
              {PACKAGE_PLANS.map((plan) => (
                <div key={plan.key} className="flex justify-between px-5 py-3 text-sm">
                  <span className="text-uber-body-gray">{plan.label}</span>
                  <span className="font-bold">{rupees(getPackageRate(vehicle, plan.rateKey))}</span>
                </div>
              ))}
              <div className="flex justify-between px-5 py-3 text-sm">
                <span className="text-uber-body-gray">Tax</span>
                <span className="font-bold">{GST_INCLUSIVE_COPY}</span>
              </div>
            </div>

            <div className="mt-8">
              <h2 className="mb-3 text-xl font-bold">About this {vehicleType}</h2>
              <p className="text-sm leading-relaxed text-uber-body-gray">
                Pickup coverage: {pickupZone || "select an active pickup location"}. Package prices include GST, and we’ll confirm availability after you send your request.
              </p>
              <div className="mt-5 rounded-lg border border-black/10 bg-[#f7f7f7] p-4" aria-live="polite">
                <h3 className="mb-1 text-sm font-bold">Cancellation policy</h3>
                {policyLoading ? (
                  <p className="text-sm text-uber-body-gray">Loading current cancellation terms…</p>
                ) : cancellationPolicy ? (
                  <p className="text-sm text-uber-body-gray">
                    If pickup is at least 24 hours away, the cancellation charge is {cancellationPolicy.cancellation_over_24h_percent}%. If pickup is under 24 hours away, it is {cancellationPolicy.cancellation_under_24h_percent}%.
                  </p>
                ) : (
                  <p className="text-sm text-uber-body-gray">
                    Cancellation charges depend on the time remaining before pickup. Contact support if you need help understanding the applicable charge.
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="h-fit lg:sticky lg:top-24">
            <div className="rounded-[24px] bg-white p-6 shadow-[rgba(0,0,0,0.12)_0px_4px_16px_0px]">
              <h2 className="mb-5 text-xl font-bold">Reserve this {vehicleType}</h2>

              <div className="mb-4">
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-uber-body-gray">Package</label>
                <div className="flex flex-wrap gap-2" role="group" aria-label="Rental package">
                  {PACKAGE_PLANS.map((plan) => (
                    <button
                      key={plan.key}
                      aria-pressed={packageKey === plan.rateKey}
                      type="button"
                      onClick={() => {
                        dropManuallyEdited.current = false;
                        setPackageKey(plan.rateKey);
                        setBookingError(null);
                      }}
                      className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
                        packageKey === plan.rateKey ? "bg-black text-white" : "bg-[#efefef] text-black hover:bg-[#e2e2e2]"
                      }`}
                    >
                      {plan.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-4 flex items-center justify-between border-t border-black/5 py-3">
                <div>
                  <div className="text-sm font-medium">Extra Helmet</div>
                  <div className="text-xs text-uber-body-gray">Additional Rs. 50/rental</div>
                </div>
                <button
                  type="button"
                  onClick={() => setExtraHelmet(!extraHelmet)}
                  className={`relative h-6 w-11 rounded-full transition-colors duration-200 ${extraHelmet ? "bg-black" : "bg-uber-muted-gray"}`}
                  role="switch"
                  aria-checked={extraHelmet}
                >
                  <span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${extraHelmet ? "translate-x-5" : "translate-x-0"}`} />
                </button>
              </div>

              <div className="mb-4 border-t border-black/5 pt-4">
                <label htmlFor="booking-pickup-location" className="mb-2 block text-xs font-semibold uppercase tracking-wider text-uber-body-gray">
                  Pickup location
                </label>
                <select
                  id="booking-pickup-location"
                  className="mb-1 w-full rounded-lg border border-black px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                  value={pickupZone}
                  disabled={locationsLoading || locations.length === 0}
                  onChange={(event) => {
                    const nextLocation = event.target.value;
                    setPickupZone(nextLocation);
                    const nextParams = new URLSearchParams(searchParams.toString());
                    nextParams.set("pickup_location", nextLocation);
                    router.replace(`/book/${vehicleId}?${nextParams.toString()}`, { scroll: false });
                  }}
                >
                  {locationsLoading && <option value="">Loading pickup locations…</option>}
                  {!locationsLoading && locations.length === 0 && <option value="">No pickup locations available</option>}
                  {locations.map((location) => <option key={location.id} value={location.name}>{location.name}</option>)}
                </select>
                {locationsError && <p role="alert" className="mb-2 text-xs text-red-700">{locationsError}</p>}
                <label htmlFor="booking-pickup-address" className="sr-only">Pickup address or note</label>
                <input
                  id="booking-pickup-address"
                  type="text"
                  placeholder="Apartment, landmark, or pickup note"
                  value={pickupAddress}
                  onChange={(event) => setPickupAddress(event.target.value)}
                  className="w-full rounded-lg border border-black/20 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                />
              </div>

              <div className="mb-4 rounded-2xl border border-black/5 bg-[#f7f7f7] p-5">
                <h3 className="mb-3 text-sm font-bold text-black">Rental dates</h3>
                <BookingScheduleFields
                  pickupDate={pickupDate}
                  pickupTime={pickupTime}
                  dropDate={dropDate}
                  dropTime={dropTime}
                  minPickupDate={toDateValue(new Date())}
                  onPickupDateChange={setPickupDate}
                  onPickupTimeChange={setPickupTime}
                  onDropDateChange={(value) => {
                    dropManuallyEdited.current = true;
                    setDropDate(value);
                  }}
                  onDropTimeChange={(value) => {
                    dropManuallyEdited.current = true;
                    setDropTime(value);
                  }}
                />
                {unitsAvailable !== null && (
                  <p className={`mt-3 text-xs ${unitsAvailable > 0 ? "text-green-700" : "text-red-600"}`}>
                    {unitsAvailable > 0
                      ? `${unitsAvailable} unit${unitsAvailable === 1 ? "" : "s"} available for these dates.`
                      : "No units available for these dates. Try different dates or another vehicle."}
                  </p>
                )}
              </div>

              <div className="mb-4 rounded-2xl border border-black/5 bg-[#f7f7f7] p-5">
                <h3 className="mb-3 text-sm font-bold text-black">Selected rental window</h3>
                <div className="space-y-2 text-[13px] text-uber-body-gray">
                  <div className="flex justify-between gap-4">
                    <span>Pickup</span>
                    <span className="text-right font-semibold text-black">
                      {formatScheduleTime(pickupAt)}
                    </span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span>Drop</span>
                    <span className="text-right font-semibold text-black">
                      {formatScheduleTime(dropAt)}
                    </span>
                  </div>
                </div>
              </div>



              <div className="mb-4 border-t border-black/5 pt-4">
                <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-uber-body-gray">
                  Contact details
                </div>
                <div className="grid grid-cols-1 gap-3">
                  <input className="form-input" value={legalName} onChange={(event) => setLegalName(event.target.value)} placeholder="Full name" />
                  <input className="form-input" value={profileEmail} onChange={(event) => setProfileEmail(event.target.value)} placeholder="Email" />
                  <input className="form-input" value={mobile} onChange={(event) => setMobile(event.target.value)} placeholder="Mobile" />
                </div>
              </div>

              <div className="mb-4 min-h-[112px] border-t border-black/10 pt-4">
                {quoteLoading ? (
                  <div className="flex items-center gap-2 py-4 text-sm text-uber-body-gray">
                    <span className="spinner" />
                    Calculating price...
                  </div>
                ) : quoteError ? (
                  <p className="py-2 text-xs text-red-600">{quoteError}</p>
                ) : displayQuote ? (
                  <>
                    {!isSignedIn ? (
                      <p className="mb-2 text-xs text-uber-muted-gray">
                        Estimated total — sign in for an exact server quote; any promotion eligibility is validated there.
                      </p>
                    ) : null}
                    <CostBreakdown quote={displayQuote} showDeposit />
                  </>
                ) : isSignedIn ? (
                  <p className="py-2 text-xs text-uber-muted-gray">Select dates to calculate your quote.</p>
                ) : null}
              </div>

              <div className="mb-6 rounded-2xl border border-black/5 bg-[#f7f7f7] p-5">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-black">
                  <Icon name="shield" className="h-4 w-4" />
                  Rental Policies
                </h3>
                <ul className="space-y-2 text-[13px] text-uber-body-gray">

                  <li className="flex items-center justify-between">
                    <span>Availability</span>
                    <span className="text-right font-semibold text-black">Confirmed by team</span>
                  </li>
                  <li className="flex items-center justify-between">
                    <span>Fuel</span>
                    <span className="text-right font-semibold text-black">Return same level</span>
                  </li>
                </ul>
              </div>

              {bookingError && <p className="mb-3 text-xs text-red-600">{bookingError}</p>}
              <button
                type="button"
                onClick={handleReserve}
                disabled={
                  bookingLoading ||
                  (isSignedIn && (quoteLoading || !quote)) ||
                  !scheduleValid ||
                  unitsAvailable === 0
                }
                className="w-full rounded-full bg-black py-4 text-base font-bold text-white transition-colors hover:bg-[#e2e2e2] hover:text-black disabled:cursor-not-allowed disabled:opacity-50"
              >
                {bookingLoading
                  ? "Submitting..."
                  : isSignedIn
                    ? "Submit Booking Request"
                    : "Sign in to submit request"}
              </button>

              <p className="mt-3 text-center text-xs text-uber-muted-gray">We’ll confirm availability and payment details before your booking is finalized.</p>
            </div>
          </div>
        </div>
      </div>

      <LoginPromptModal
        open={showLoginPrompt}
        onClose={() => setShowLoginPrompt(false)}
        returnPath={returnPath}
        title="Sign in to book"
        description="Sign in or create an account to submit this booking request. Your selected dates will be kept."
        onSignedIn={() => {
          setShowLoginPrompt(false);
          setBookingError(null);
        }}
      />

      <BookingFeedbackModal
        open={Boolean(feedback)}
        type={feedback?.type ?? "error"}
        title={feedback?.title ?? ""}
        message={feedback?.message ?? ""}
        bookingId={feedback?.bookingId}
        onClose={() => setFeedback(null)}
      />
    </div>
  );
}
