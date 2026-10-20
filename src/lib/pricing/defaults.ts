import type { Vehicle } from "@/lib/types/domain";

export interface MileagePricingDefaults {
  included_km_per_hour: number;
  included_km_per_day: number;
  included_km_per_week: number;
  included_km_per_month: number;
  excess_km_rate: number;
}

export const DEFAULT_INCLUDED_KM = {
  hour: 10,
  day: 120,
  week: 900,
  month: 3000
} as const;

const DEFAULT_EXCESS_KM_RATE: Record<Vehicle["category"], number> = {
  scooter: 5,
  bike: 7,
  ev_bike: 6
};

export function getDefaultMileagePricing(
  category: Vehicle["category"]
): MileagePricingDefaults {
  return {
    included_km_per_hour: DEFAULT_INCLUDED_KM.hour,
    included_km_per_day: DEFAULT_INCLUDED_KM.day,
    included_km_per_week: DEFAULT_INCLUDED_KM.week,
    included_km_per_month: DEFAULT_INCLUDED_KM.month,
    excess_km_rate: DEFAULT_EXCESS_KM_RATE[category]
  };
}
