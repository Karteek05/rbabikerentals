const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL || "admin@rbabikerentals.com";
export const COMPANY = {
  name: "RBA Bike Rentals",
  brand: "RBA Bike Rentals",
  city: "Bengaluru",
  state: "Karnataka",
  country: "India",
  website: "https://www.rbabikerentals.com",
  supportEmail: adminEmail,
  grievanceEmail: adminEmail,
  lastUpdated: "4 July 2026"
} as const;
