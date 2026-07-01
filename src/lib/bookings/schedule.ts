import type { PackageRateKey } from "@/lib/fleet/catalog";

export type SearchParamReader = {
  get(name: string): string | null;
};

type BookingSchedule = {
  pickupAt: string;
  dropAt: string;
  pickupZone: string;
  usedFallback: boolean;
};

const DEFAULT_PICKUP_ZONE = "Sarjapur Road";

const PACKAGE_TO_DURATION_PARAM: Record<PackageRateKey, "weekly" | "fortnight" | "monthly"> = {
  rate_per_week: "weekly",
  rate_per_day: "fortnight",
  rate_per_month: "monthly"
};

const PACKAGE_TO_HOURS: Record<PackageRateKey, number> = {
  rate_per_week: 24 * 7,
  rate_per_day: 24 * 15,
  rate_per_month: 24 * 30
};

export function durationParamToPackageKey(param: string | null | undefined): PackageRateKey {
  switch (param) {
    case "monthly":
      return "rate_per_month";
    case "fortnight":
    case "15-days":
      return "rate_per_day";
    case "weekly":
    default:
      return "rate_per_week";
  }
}

export function packageKeyToDurationParam(packageKey: PackageRateKey) {
  return PACKAGE_TO_DURATION_PARAM[packageKey];
}

export function getPackageHours(packageKey: PackageRateKey) {
  return PACKAGE_TO_HOURS[packageKey];
}

export function buildBookHref(
  vehicleId: string,
  params: SearchParamReader,
  selectedDurationKey: PackageRateKey
) {
  const nextParams = new URLSearchParams();
  const urlDurationKey = durationParamToPackageKey(params.get("duration"));
  const canCarrySchedule = urlDurationKey === selectedDurationKey;

  nextParams.set("duration", packageKeyToDurationParam(selectedDurationKey));

  if (canCarrySchedule) {
    copyParam(params, nextParams, "pickup_at");
    copyParam(params, nextParams, "drop_at");
  }
  copyParam(params, nextParams, "pickup_location");

  const query = nextParams.toString();
  return query ? `/book/${vehicleId}?${query}` : `/book/${vehicleId}`;
}

export function resolveBookingScheduleFromParams(
  params: SearchParamReader,
  packageKey: PackageRateKey,
  now = new Date()
): BookingSchedule {
  const pickupZone = params.get("pickup_location")?.trim() || DEFAULT_PICKUP_ZONE;
  const durationParam = params.get("duration");
  const canUseProvidedWindow =
    !durationParam || durationParamToPackageKey(durationParam) === packageKey;
  const pickupParam = params.get("pickup_at");
  const dropParam = params.get("drop_at");
  const pickup = pickupParam ? new Date(pickupParam) : null;
  const drop = dropParam ? new Date(dropParam) : null;

  if (
    canUseProvidedWindow &&
    pickup &&
    drop &&
    Number.isFinite(pickup.getTime()) &&
    Number.isFinite(drop.getTime()) &&
    pickup.getTime() < drop.getTime()
  ) {
    return {
      pickupAt: pickup.toISOString(),
      dropAt: drop.toISOString(),
      pickupZone,
      usedFallback: false
    };
  }

  const fallbackPickup = new Date(now.getTime() + 3_600_000);
  const fallbackDrop = new Date(
    fallbackPickup.getTime() + getPackageHours(packageKey) * 3_600_000
  );

  return {
    pickupAt: fallbackPickup.toISOString(),
    dropAt: fallbackDrop.toISOString(),
    pickupZone,
    usedFallback: true
  };
}

function copyParam(
  from: SearchParamReader,
  to: URLSearchParams,
  key: string
) {
  const value = from.get(key);
  if (value) {
    to.set(key, value);
  }
}
