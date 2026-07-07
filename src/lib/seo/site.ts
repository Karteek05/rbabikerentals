import { COMPANY } from "@/lib/legal/company";
import { PUBLIC_FLEET } from "@/lib/fleet/catalog";

export const SITE_NAME = COMPANY.brand;

export function getSiteUrl() {
  const configured =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.BETTER_AUTH_URL?.trim() ||
    COMPANY.website;

  return configured.replace(/\/$/, "");
}

export const DEFAULT_SEO = {
  title: "Bike Rental in Bengaluru | Scooter & Two-Wheeler Rentals",
  description:
    "Rent scooters and bikes in Bengaluru (Bangalore) with weekly, 15-day, and monthly GST-inclusive packages. Honda Activa, Dio, and TVS Jupiter available from Sarjapur Road.",
  keywords: [
    "bike rental bangalore",
    "bike rental bengaluru",
    "scooter rental bangalore",
    "scooter rental bengaluru",
    "two wheeler rental bangalore",
    "monthly bike rental bengaluru",
    "activa rental bangalore",
    "rbabikerentals"
  ]
} as const;

export const PUBLIC_INDEXABLE_ROUTES = [
  "",
  "/browse",
  "/about",
  "/contact",
  "/faq",
  "/safety",
  "/terms",
  "/privacy",
  "/cookies",
  ...PUBLIC_FLEET.map((vehicle) => `/book/${vehicle.id}`)
] as const;

export const NOINDEX_ROUTE_PREFIXES = [
  "/login",
  "/signup",
  "/admin-login",
  "/staff-login",
  "/partner-login",
  "/dashboard-access",
  "/forgot-password",
  "/reset-password",
  "/profile",
  "/my-bookings",
  "/kyc",
  "/customer",
  "/admin",
  "/partner",
  "/api"
] as const;
