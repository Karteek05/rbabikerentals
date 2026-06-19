"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Icon from "../../components/Icon";
import { authClient } from "@/lib/auth/auth-client";
import {
  GST_INCLUSIVE_COPY,
  PACKAGE_PLANS,
  PUBLIC_FLEET_BY_ID,
  getPackageRate,
  type PackageRateKey
} from "@/lib/fleet/catalog";
import {
  durationParamToPackageKey,
  resolveBookingScheduleFromParams
} from "@/lib/bookings/schedule";

type Quote = {
  base_amount: number;
  addon_amount: number;
  coupon_discount: number;
  deposit_amount: number;
  tax_amount: number;
  total_payable: number;
  km_included: number;
  excess_km_rate: number;
};

const API_HEADERS = {
  "Content-Type": "application/json"
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

const SPECS: Record<string, Array<{ label: string; value: string }>> = {
  veh_001: [
    { label: "Engine", value: "110 cc" },
    { label: "Stock", value: "~15 units" },
    { label: "Package", value: "From Rs. 1,600" },
    { label: "Fuel", value: "Petrol" }
  ],
  veh_002: [
    { label: "Engine", value: "110 cc" },
    { label: "Stock", value: "~5 units" },
    { label: "Package", value: "From Rs. 1,600" },
    { label: "Fuel", value: "Petrol" }
  ],
  veh_003: [
    { label: "Engine", value: "125 cc" },
    { label: "Stock", value: "~5 units" },
    { label: "Package", value: "From Rs. 1,625" },
    { label: "Fuel", value: "Petrol" }
  ]
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
    return "This scooter is already booked for the selected window. Please change dates or choose another scooter.";
  }
  if (error?.code === "vehicle_blocked") {
    return "This scooter is blocked for maintenance during the selected window. Please change dates or choose another scooter.";
  }
  if (error?.code === "auth_required") {
    return "Please sign in again before submitting the booking request.";
  }
  if (status >= 500) {
    return "The booking service had a problem. Please try again in a moment.";
  }
  return error?.message ?? "Booking failed.";
}

function QuoteRow({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`flex justify-between py-2.5 text-sm ${highlight ? "mt-1 border-t border-black/10 pt-3 font-bold text-black" : "text-uber-body-gray"}`}>
      <span>{label}</span>
      <span className="text-black">{value}</span>
    </div>
  );
}

export default function BookPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const queryString = searchParams.toString();
  const { data: session } = authClient.useSession();
  const vehicleId = typeof params.vehicleId === "string" ? params.vehicleId : "";
  const vehicle = PUBLIC_FLEET_BY_ID[vehicleId];
  const initialPackageKey = durationParamToPackageKey(searchParams.get("duration"));
  const initialSchedule = resolveBookingScheduleFromParams(
    searchParams,
    initialPackageKey
  );

  const [packageKey, setPackageKey] = useState<PackageRateKey>(initialPackageKey);
  const [extraHelmet, setExtraHelmet] = useState(false);
  const [coupon, setCoupon] = useState("");
  const [pickupZone, setPickupZone] = useState(initialSchedule.pickupZone);
  const [pickupAddress, setPickupAddress] = useState("");
  const [legalName, setLegalName] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [bookingError, setBookingError] = useState<string | null>(null);

  const durationBucket = PACKAGE_TO_BUCKET[packageKey];
  const durationValue = PACKAGE_TO_VALUE[packageKey];
  const bookingSchedule = useMemo(
    () => resolveBookingScheduleFromParams(searchParams, packageKey),
    [queryString, searchParams, packageKey]
  );

  useEffect(() => {
    const nextPackageKey = durationParamToPackageKey(searchParams.get("duration"));
    const nextSchedule = resolveBookingScheduleFromParams(
      searchParams,
      nextPackageKey
    );
    setPackageKey(nextPackageKey);
    setPickupZone(nextSchedule.pickupZone);
    setBookingError(null);
  }, [queryString, searchParams]);

  const fetchQuote = useCallback(async () => {
    if (!vehicle || !session?.user?.id) return;
    setQuoteLoading(true);
    setQuoteError(null);
    try {
      const res = await fetch("/api/quotes", {
        method: "POST",
        headers: API_HEADERS,
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
      setBookingError("Please sign in before submitting a booking request.");
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
        headers: API_HEADERS,
        body: JSON.stringify({
          user_id: session?.user?.id,
          vehicle_id: vehicleId,
          city: "bengaluru",
          pickup_at: bookingSchedule.pickupAt,
          drop_at: bookingSchedule.dropAt,
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
        setBookingError(getBookingErrorMessage(res.status, json?.error));
      } else {
        setBookingId(json.data.booking.id);
      }
    } catch {
      setBookingError("Could not reach the booking service. Check that the site is running and try again.");
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
        <p className="mb-6 text-uber-body-gray">That vehicle is not in the current rental fleet.</p>
        <a href="/browse" className="btn-primary">
          Back to Browse
        </a>
      </div>
    );
  }

  if (bookingId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white px-4">
        <div className="max-w-md text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-black text-white">
            <Icon name="checkCircle" className="h-10 w-10" />
          </div>
          <h1 className="mb-3 text-4xl font-bold">Request Submitted</h1>
          <p className="mb-2 text-sm text-uber-body-gray">
            We received your booking request. The team will confirm availability and payment details.
          </p>
          <div className="my-6 break-all rounded-xl bg-uber-chip-gray px-6 py-4 font-mono text-lg font-bold tracking-widest">
            {bookingId}
          </div>
          <div className="flex flex-col justify-center gap-3 sm:flex-row">
            <a href="/my-bookings" className="btn-primary px-6 py-3">
              View My Bookings
            </a>
            <a href="/browse" className="btn-secondary px-6 py-3">
              Browse More
            </a>
          </div>
        </div>
      </div>
    );
  }

  const specs = SPECS[vehicleId] ?? [];

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
            <p className="mb-6 text-uber-body-gray capitalize">Scooter - {vehicle.engine}</p>

            {specs.length > 0 && (
              <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
                {specs.map((s) => (
                  <div key={s.label} className="rounded-lg bg-uber-chip-gray px-4 py-3">
                    <div className="mb-0.5 text-xs text-uber-body-gray">{s.label}</div>
                    <div className="text-sm font-bold">{s.value}</div>
                  </div>
                ))}
              </div>
            )}

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
              <h2 className="mb-3 text-xl font-bold">About this scooter</h2>
              <p className="text-sm leading-relaxed text-uber-body-gray">
                This {vehicle.brand} {vehicle.model} is part of the current Bengaluru scooter fleet. Package pricing is
                GST-inclusive and availability is confirmed after you submit the request.
              </p>
            </div>
          </div>

          <div className="h-fit lg:sticky lg:top-24">
            <div className="rounded-[24px] bg-white p-6 shadow-[rgba(0,0,0,0.12)_0px_4px_16px_0px]">
              <h2 className="mb-5 text-xl font-bold">Reserve this scooter</h2>

              <div className="mb-4">
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-uber-body-gray">Package</label>
                <div className="flex flex-wrap gap-2">
                  {PACKAGE_PLANS.map((plan) => (
                    <button
                      key={plan.key}
                      type="button"
                      onClick={() => {
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
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-uber-body-gray">
                  Pickup zone
                </label>
                <select
                  className="mb-3 w-full rounded-lg border border-black px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                  value={pickupZone}
                  onChange={(event) => setPickupZone(event.target.value)}
                >
                  <option value="Indiranagar">Indiranagar</option>
                  <option value="Koramangala">Koramangala</option>
                  <option value="Whitefield">Whitefield</option>
                  <option value="Jayanagar">Jayanagar</option>
                  <option value="Hebbal">Hebbal</option>
                </select>
                <input
                  type="text"
                  placeholder="Apartment, landmark, or pickup note"
                  value={pickupAddress}
                  onChange={(event) => setPickupAddress(event.target.value)}
                  className="w-full rounded-lg border border-black/20 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                />
              </div>

              <div className="mb-4 rounded-2xl border border-black/5 bg-[#f7f7f7] p-5">
                <h3 className="mb-3 text-sm font-bold text-black">Selected rental window</h3>
                <div className="space-y-2 text-[13px] text-uber-body-gray">
                  <div className="flex justify-between gap-4">
                    <span>Pickup</span>
                    <span className="text-right font-semibold text-black">
                      {formatScheduleTime(bookingSchedule.pickupAt)}
                    </span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span>Drop</span>
                    <span className="text-right font-semibold text-black">
                      {formatScheduleTime(bookingSchedule.dropAt)}
                    </span>
                  </div>
                </div>
                {bookingSchedule.usedFallback && (
                  <p className="mt-3 text-xs text-uber-muted-gray">
                    No date selection was passed in, so this uses the selected package duration from the next available hour.
                  </p>
                )}
              </div>

              <div className="mb-4 border-t border-black/5 pt-4">
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-uber-body-gray">Coupon Code</label>
                <input
                  type="text"
                  placeholder="e.g. WELCOME5"
                  value={coupon}
                  onChange={(e) => setCoupon(e.target.value.toUpperCase())}
                  className="w-full rounded-lg border border-black px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                />
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
                ) : quote ? (
                  <>
                    <QuoteRow label="Package fare" value={rupees(quote.base_amount)} />
                    {quote.addon_amount > 0 && <QuoteRow label="Extra helmet" value={rupees(quote.addon_amount)} />}
                    {quote.coupon_discount > 0 && <QuoteRow label="Coupon discount" value={`-${rupees(quote.coupon_discount)}`} />}
                    <QuoteRow label="GST" value="Included" />
                    {quote.deposit_amount > 0 && <QuoteRow label="Security deposit" value={rupees(quote.deposit_amount)} />}
                    <QuoteRow label="Total payable" value={rupees(quote.total_payable)} highlight />
                    <p className="mt-2 text-xs text-uber-muted-gray">
                      Includes {quote.km_included} km - Rs. {quote.excess_km_rate}/km extra
                    </p>
                  </>
                ) : null}
              </div>

              <div className="mb-6 rounded-2xl border border-black/5 bg-[#f7f7f7] p-5">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-black">
                  <Icon name="shield" className="h-4 w-4" />
                  Rental Policies
                </h3>
                <ul className="space-y-2 text-[13px] text-uber-body-gray">
                  <li className="flex items-center justify-between">
                    <span>Cancellation</span>
                    <span className="text-right font-semibold text-black">Free up to 24h</span>
                  </li>
                  <li className="flex items-center justify-between">
                    <span>Late Return</span>
                    <span className="text-right font-semibold text-black">Rs. 50/hr after grace</span>
                  </li>
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
                disabled={bookingLoading || quoteLoading || !quote}
                className="w-full rounded-full bg-black py-4 text-base font-bold text-white transition-colors hover:bg-[#e2e2e2] hover:text-black disabled:cursor-not-allowed disabled:opacity-50"
              >
                {bookingLoading ? "Submitting..." : "Submit Booking Request"}
              </button>

              <p className="mt-3 text-center text-xs text-uber-muted-gray">Availability and payment details are confirmed after review.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
