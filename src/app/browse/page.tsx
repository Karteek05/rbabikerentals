"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import Icon from "../components/Icon";
import Select from "@/components/ui/Select";
import { VehicleGridSkeleton } from "@/components/ui/Skeleton";
import {
  GST_INCLUSIVE_COPY,
  PACKAGE_PLANS,
  getPackageRate,
  type PackageRateKey,
  type PublicFleetVehicle
} from "@/lib/fleet/catalog";
import {
  buildBookHref,
  durationParamToPackageKey
} from "@/lib/bookings/schedule";

import { usePublicFleet } from "@/lib/fleet/use-public-fleet";

const CATEGORY_LABEL: Record<string, string> = {
  scooter: "Scooters",
  bike: "Bikes",
  ev_bike: "EV bikes"
};

const DURATIONS = [
  { key: "weekly", label: "1 week", rateKey: "rate_per_week" as const },
  { key: "fortnight", label: "15 days", rateKey: "rate_per_day" as const },
  { key: "monthly", label: "Monthly", rateKey: "rate_per_month" as const }
];

function VehicleCard({
  vehicle,
  durationKey,
  bookingHref,
  availability
}: {
  vehicle: PublicFleetVehicle;
  durationKey: PackageRateKey;
  bookingHref: string;
  availability?: {
    available_units: number;
    total_units: number;
    is_available: boolean;
  };
}) {
  const rate = getPackageRate(vehicle, durationKey);
  const durUnit = PACKAGE_PLANS.find((d) => d.rateKey === durationKey)?.unit ?? "week";
  const availableUnits = availability?.available_units ?? vehicle.stockApprox;
  const totalUnits = availability?.total_units ?? vehicle.stockApprox;
  const isAvailable = availability?.is_available ?? vehicle.is_active;
  const cardClassName = `group block ${isAvailable ? "" : "pointer-events-none opacity-80"}`;

  return (
    <Link href={isAvailable ? bookingHref : "#"} className={cardClassName} aria-disabled={!isAvailable}>
      <article className="card transition-colors duration-200 group-hover:border-[color:var(--color-ink)]">
        <div className="relative aspect-[16/10] overflow-hidden bg-[color:var(--color-paper-2)]">
          <img
            src={vehicle.image}
            alt={vehicle.imageAlt}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            loading="lazy"
            onError={(event) => {
              event.currentTarget.src = vehicle.fallbackImage;
            }}
          />
          <span className="absolute left-3 top-3 rounded-full bg-white/90 px-3 py-1 text-[11px] font-bold capitalize text-[color:var(--color-ink)]">
            {vehicle.category.replace("_", " ")}
          </span>
          <span className={`absolute right-3 top-3 rounded-full px-3 py-1 text-[11px] font-bold ${isAvailable ? "bg-[color:var(--color-green)] text-white" : "bg-red-600 text-white"}`}>
            {isAvailable ? `${availableUnits} of ${totalUnits} available` : "No units available"}
          </span>
        </div>

        <div className="p-5">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <h3 className="text-xl font-black leading-tight text-[color:var(--color-ink)]">
                {vehicle.brand} {vehicle.model}
              </h3>
              <div className="mt-2 flex items-center gap-1 text-xs capitalize text-[color:var(--color-muted)]">
                <Icon name="location" className="h-3.5 w-3.5" />
                Bengaluru · {availableUnits} of {totalUnits} units free
              </div>
            </div>
          </div>

          <div className="mb-4 flex items-end justify-between gap-4 border-y border-[color:var(--color-line)] py-4">
            <div>
              <span className="text-3xl font-black text-[color:var(--color-ink)]">Rs. {rate.toLocaleString()}</span>
              <span className="ml-1 text-sm text-[color:var(--color-copy)]">/{durUnit}</span>
            </div>
            <p className="text-right text-xs text-[color:var(--color-muted)]">
              {GST_INCLUSIVE_COPY}<br />
              package fare
            </p>
          </div>

          <span className={`btn-primary w-full py-2.5 text-sm ${isAvailable ? "" : "bg-[color:var(--color-muted)]"}`}>
            {isAvailable ? "Book Now" : "Unavailable for selected dates"}
          </span>
        </div>
      </article>
    </Link>
  );
}

function BrowsePageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialDuration = durationParamToPackageKey(searchParams.get("duration"));
  const publicFleet = usePublicFleet();
  const [category, setCategory] = useState("all");
  const [duration, setDuration] = useState<PackageRateKey>(initialDuration);
  const [maxPrice, setMaxPrice] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<"price_asc" | "price_desc" | "model">("price_asc");
  const [availabilityMap, setAvailabilityMap] = useState<
    Record<string, { available_units: number; total_units: number; is_available: boolean }>
  >({});
  const [availabilityLoading, setAvailabilityLoading] = useState(true);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);
  const [locations, setLocations] = useState<Array<{ id: string; name: string; active: boolean }>>([]);
  const [locationsLoading, setLocationsLoading] = useState(true);
  const [locationsError, setLocationsError] = useState<string | null>(null);
  const selectedLocation = searchParams.get("pickup_location") ?? "";
  const categories = useMemo(
    () => [
      { key: "all", label: "All" },
      ...Array.from(new Set(publicFleet.map((vehicle) => vehicle.category)))
        .map((key) => ({ key, label: CATEGORY_LABEL[key] ?? key }))
    ],
    [publicFleet]
  );
  const sortOptions = useMemo(
    () => [
      { value: "price_asc", label: "Price: Low to High" },
      { value: "price_desc", label: "Price: High to Low" },
      { value: "model", label: "Model Name" }
    ],
    []
  );
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
        const current = searchParams.get("pickup_location");
        if (!current || !next.some((item: { name: string }) => item.name === current)) {
          const params = new URLSearchParams(searchParams.toString());
          if (next[0]?.name) params.set("pickup_location", next[0].name);
          else params.delete("pickup_location");
          router.replace(`/browse${params.size ? `?${params.toString()}` : ""}`, { scroll: false });
        }
      })
      .catch(() => { if (active) setLocationsError("Could not load pickup locations. Please try again."); })
      .finally(() => { if (active) setLocationsLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    setDuration(durationParamToPackageKey(searchParams.get("duration")));
  }, [searchParams]);

  useEffect(() => {
    const query = searchParams.toString();
    setAvailabilityLoading(true);
    setAvailabilityError(null);
    fetch(`/api/fleet/availability?${query}`, { credentials: "include" })
      .then((res) => res.json())
      .then((json) => {
        if (!json?.ok || !Array.isArray(json.data?.items)) {
          setAvailabilityError("Availability could not be loaded. Prices and catalog details are still available.");
          return;
        }
        const next: Record<string, { available_units: number; total_units: number; is_available: boolean }> = {};
        for (const item of json.data.items) {
          next[item.vehicle_id] = {
            available_units: item.available_units,
            total_units: item.total_units,
            is_available: item.is_available
          };
        }
        setAvailabilityMap(next);
      })
      .catch(() => {
        setAvailabilityMap({});
        setAvailabilityError("Availability could not be loaded. Prices and catalog details are still available.");
      })
      .finally(() => setAvailabilityLoading(false));
  }, [searchParams]);

  const currentDurUnit = PACKAGE_PLANS.find((d) => d.rateKey === duration)?.unit ?? "week";
  const maxAvailablePrice = Math.max(100, ...publicFleet.map((vehicle) => getPackageRate(vehicle, duration)));

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    const list = publicFleet.filter((vehicle) => {
      const matchCat = category === "all" || vehicle.category === category;
      const rate = getPackageRate(vehicle, duration);
      const matchPrice = maxPrice === null || rate <= maxPrice;
      const matchQuery =
        !normalizedQuery || `${vehicle.brand} ${vehicle.model}`.toLowerCase().includes(normalizedQuery);
      return matchCat && matchPrice && matchQuery;
    });

    return list.sort((a, b) => {
      if (sortBy === "model") {
        return `${a.brand} ${a.model}`.localeCompare(`${b.brand} ${b.model}`);
      }
      const aRate = getPackageRate(a, duration);
      const bRate = getPackageRate(b, duration);
      return sortBy === "price_asc" ? aRate - bRate : bRate - aRate;
    });
  }, [category, duration, maxPrice, query, sortBy, publicFleet]);

  return (
    <div className="min-h-screen bg-[color:var(--color-paper)]">
      <section className="border-b border-[color:var(--color-line)] bg-[color:var(--color-ink)] py-12 text-white sm:py-16">
        <div className="section-shell">
          <div className="grid gap-8 md:grid-cols-[1fr_340px] md:items-end">
            <div>
              <p className="mb-3 text-sm font-semibold text-[color:var(--color-accent)]">Bengaluru vehicle rentals</p>
              <h1 className="max-w-3xl text-[clamp(2.75rem,7vw,6.25rem)] font-black leading-none text-white">
                Find the right ride for your day.
              </h1>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/5 p-5">
              <div className="text-3xl font-black text-white">{filtered.length}</div>
              <p className="mt-1 text-sm leading-relaxed text-white/62">
                {filtered.length} catalog model{filtered.length === 1 ? "" : "s"} match your filters.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="sticky top-[72px] z-40 border-b border-[color:var(--color-line)] bg-[color:var(--color-paper)]/95 backdrop-blur-md">
        <div className="section-shell py-4">
          <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
            <div className="flex flex-wrap gap-2">
              {categories.map((item) => (
                <button
                  key={item.key}
                  onClick={() => setCategory(item.key)}
                  aria-pressed={category === item.key}
                  className={`chip ${category === item.key ? "chip-active" : ""}`}
                >
                  {item.label}
                </button>
              ))}
              {DURATIONS.map((item) => (
                <button
                  key={item.key}
                  onClick={() => {
                    setDuration(item.rateKey);
                    const params = new URLSearchParams(searchParams.toString());
                    params.set("duration", item.key);
                    router.replace(`/browse?${params.toString()}`, { scroll: false });
                  }}
                  aria-pressed={duration === item.rateKey}
                  className={`chip ${duration === item.rateKey ? "chip-active" : ""}`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <label className="sr-only" htmlFor="browse-pickup-location">Pickup location</label>
            <select
              id="browse-pickup-location"
              value={selectedLocation}
              disabled={locationsLoading || locations.length === 0}
              onChange={(event) => {
                const params = new URLSearchParams(searchParams.toString());
                params.set("pickup_location", event.target.value);
                router.push(`/browse?${params.toString()}`, { scroll: false });
              }}
              className="field-control"
            >
              {locationsLoading && <option value="">Loading pickup locations…</option>}
              {!locationsLoading && locations.length === 0 && <option value="">No pickup locations available</option>}
              {locations.map((location) => <option key={location.id} value={location.name}>{location.name}</option>)}
            </select>
            {locationsError && <p role="alert" className="text-xs text-red-700">{locationsError}</p>}
            <div className="grid gap-3 sm:grid-cols-[220px_190px] lg:grid-cols-[220px_190px]">
              <div className="relative">
                <Icon name="search" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--color-muted)]" />
                <input
                  aria-label="Search vehicle models"
                  type="text"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search model"
                  className="field-control pl-9"
                />
              </div>
              <Select
                value={sortBy}
                onChange={(value) => setSortBy(value as "price_asc" | "price_desc" | "model")}
                options={sortOptions}
                aria-label="Sort vehicles"
              />
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
            <label htmlFor="browse-max-price" className="text-sm font-semibold text-[color:var(--color-copy)]">
              Max Rs. {(maxPrice ?? maxAvailablePrice).toLocaleString("en-IN")}/{currentDurUnit}
            </label>
            <input
              id="browse-max-price"
              type="range"
              min={Math.min(120, maxAvailablePrice)}
              max={maxAvailablePrice}
              step={100}
              value={Math.min(maxPrice ?? maxAvailablePrice, maxAvailablePrice)}
              onChange={(event) => setMaxPrice(Number(event.target.value))}
              className="w-full accent-[color:var(--color-ink)] sm:w-72"
            />
          </div>
        </div>
      </section>

      <section className="section-shell py-10 sm:py-12">
        {availabilityError && (
          <p className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950" role="alert">
            {availabilityError}
          </p>
        )}
        {filtered.length === 0 ? (
          <div className="mx-auto max-w-lg rounded-lg border border-dashed border-[color:var(--color-line)] bg-white p-10 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[color:var(--color-paper-2)]">
              <Icon name="search" className="h-7 w-7 text-[color:var(--color-copy)]" />
            </div>
            <h2 className="mb-2 text-2xl font-black text-[color:var(--color-ink)]">No vehicles match your filters</h2>
            <p className="mb-6 text-sm text-[color:var(--color-copy)]">Try adjusting category, price, or model search.</p>
            <button
              onClick={() => {
                setCategory("all");
                setMaxPrice(null);
                setQuery("");
                setSortBy("price_asc");
              }}
              className="btn-primary"
            >
              Clear Filters
            </button>
          </div>
        ) : availabilityLoading ? (
          <VehicleGridSkeleton count={filtered.length || 3} />
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((vehicle) => (
              <VehicleCard
                key={vehicle.id}
                vehicle={vehicle}
                durationKey={duration}
                bookingHref={buildBookHref(vehicle.id, searchParams, duration)}
                availability={availabilityMap[vehicle.id]}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default function BrowsePage() {
  return (
    <Suspense fallback={<VehicleGridSkeleton count={6} />}>
      <BrowsePageContent />
    </Suspense>
  );
}
