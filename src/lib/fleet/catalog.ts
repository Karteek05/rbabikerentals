export type PublicFleetVehicle = {
  id: string;
  brand: string;
  model: string;
  category: "scooter" | "bike";
  icon: "scooter" | "bike";
  stockApprox: number;
  engine: string;
  fuel: "Petrol";
  image: string;
  fallbackImage: string;
  imageAlt: string;
  deposit_amount: number;
  rate_per_hour: number;
  rate_per_day: number;
  rate_per_week: number;
  rate_per_month: number;
  city: "bengaluru";
  is_active: boolean;
  spec: string;
};

export const GST_INCLUSIVE_COPY = "Package fares include GST";

export const PUBLIC_FLEET: PublicFleetVehicle[] = [
  {
    id: "veh_001",
    brand: "Honda",
    model: "Activa 110",
    category: "scooter",
    icon: "scooter",
    stockApprox: 15,
    engine: "110 cc",
    fuel: "Petrol",
    image: "https://edge.sitecorecloud.io/hondamotorc388f-hmsi8ece-prodb777-e813/media/Project/HONDA2WI/honda2wheelersindia/scooter/Activa-110/Accessories/activa110-accessories.png?h=810&iar=0&w=1920",
    fallbackImage: "/images/services/activa-6g.svg",
    imageAlt: "Honda Activa 110 scooter illustration",
    deposit_amount: 2000,
    rate_per_hour: 0,
    rate_per_day: 3200,
    rate_per_week: 1600,
    rate_per_month: 6000,
    city: "bengaluru",
    is_active: true,
    spec: "110 cc petrol scooter"
  },
  {
    id: "veh_002",
    brand: "Honda",
    model: "Dio 110",
    category: "scooter",
    icon: "scooter",
    stockApprox: 5,
    engine: "110 cc",
    fuel: "Petrol",
    image: "https://edge.sitecorecloud.io/hondamotorc388f-hmsi8ece-prodb777-e813/media/Project/HONDA2WI/honda2wheelersindia/scooter/dio-110/dio110-accessories.png?h=810&iar=0&w=1920",
    fallbackImage: "/images/services/dio-110.svg",
    imageAlt: "Honda Dio 110 scooter illustration",
    deposit_amount: 2000,
    rate_per_hour: 0,
    rate_per_day: 3200,
    rate_per_week: 1600,
    rate_per_month: 6000,
    city: "bengaluru",
    is_active: true,
    spec: "110 cc petrol scooter"
  },
  {
    id: "veh_003",
    brand: "TVS",
    model: "Jupiter 125",
    category: "scooter",
    icon: "scooter",
    stockApprox: 5,
    engine: "125 cc",
    fuel: "Petrol",
    image: "https://www.tvsmotor.com/tvs-jupiter-125/-/media/TVS-Jupiter-125/Disc-SE/Price-Fold/dual-tone-website-copy-%281%29.webp",
    fallbackImage: "/images/services/jupiter-125.svg",
    imageAlt: "TVS Jupiter 125 scooter illustration",
    deposit_amount: 2000,
    rate_per_hour: 0,
    rate_per_day: 3250,
    rate_per_week: 1625,
    rate_per_month: 6500,
    city: "bengaluru",
    is_active: true,
    spec: "125 cc petrol scooter"
  },
  {
    id: "veh_004",
    brand: "TVS",
    model: "Raider",
    category: "bike",
    icon: "bike",
    stockApprox: 2,
    engine: "125 cc",
    fuel: "Petrol",
    image: "/images/services/raider.svg",
    fallbackImage: "/images/services/raider.svg",
    imageAlt: "TVS Raider bike illustration",
    deposit_amount: 2000,
    rate_per_hour: 0,
    rate_per_day: 3500,
    rate_per_week: 1750,
    rate_per_month: 7000,
    city: "bengaluru",
    is_active: false,
    spec: "125 cc petrol bike"
  }
];

export const PUBLIC_FLEET_BY_ID = Object.fromEntries(
  PUBLIC_FLEET.map((vehicle) => [vehicle.id, vehicle])
) as Record<string, PublicFleetVehicle>;

export const PACKAGE_PLANS = [
  { key: "week", label: "1 week", unit: "week", rateKey: "rate_per_week" },
  { key: "fortnight", label: "15 days", unit: "15 days", rateKey: "rate_per_day" },
  { key: "month", label: "Monthly", unit: "month", rateKey: "rate_per_month" }
] as const;

export type PackageRateKey = (typeof PACKAGE_PLANS)[number]["rateKey"];

export function getPackageRate(vehicle: PublicFleetVehicle, rateKey: PackageRateKey) {
  return vehicle[rateKey];
}

/** Maps a physical unit to the customer-facing catalog model id. */
export function inferFleetUnitFromChassis(chassis: string) {
  const normalized = chassis.trim().toUpperCase();
  if (normalized.startsWith("MD625")) {
    return {
      brand: "TVS",
      model: "Raider",
      category: "bike" as const,
      image: "/images/services/raider.svg"
    };
  }
  if (normalized.startsWith("ME4JK")) {
    return {
      brand: "Honda",
      model: "Dio 110",
      category: "scooter" as const,
      image: "/images/services/dio-110.svg"
    };
  }
  return {
    brand: "Honda",
    model: "Activa 110",
    category: "scooter" as const,
    image: "/images/services/activa-6g.svg"
  };
}

/** Maps a physical unit to the customer-facing catalog model id. */
export function inferCatalogVehicleId(input: {
  brand?: string;
  model?: string;
  category?: string;
}) {
  const brand = (input.brand ?? "").toLowerCase();
  const model = (input.model ?? "").toLowerCase();

  if (brand.includes("honda") && model.includes("dio")) return "veh_002";
  if (brand.includes("honda") && model.includes("activa")) return "veh_001";
  if (brand.includes("tvs") && model.includes("jupiter")) return "veh_003";
  if (brand.includes("tvs") && model.includes("raider")) return "veh_004";
  if (brand.includes("honda")) return "veh_001";
  if (brand.includes("tvs") && input.category === "scooter") return "veh_003";
  return null;
}
