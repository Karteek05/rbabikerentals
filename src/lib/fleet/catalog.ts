export type PublicFleetVehicle = {
  id: string;
  brand: string;
  model: string;
  category: "scooter";
  icon: "scooter";
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
