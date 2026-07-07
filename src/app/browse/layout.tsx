import type { Metadata } from "next";
import { DEFAULT_SEO, SITE_NAME, getSiteUrl } from "@/lib/seo/site";

export const metadata: Metadata = {
  title: `Browse Scooters & Bikes for Rent in Bengaluru | ${SITE_NAME}`,
  description:
    "Compare Honda Activa 110, Dio 110, and TVS Jupiter 125 rental packages in Bengaluru. Weekly, 15-day, and monthly fares with GST included.",
  keywords: [
    ...DEFAULT_SEO.keywords,
    "rent activa bangalore",
    "rent scooter sarjapur road"
  ],
  alternates: {
    canonical: `${getSiteUrl()}/browse`
  },
  openGraph: {
    title: "Browse scooter rentals in Bengaluru",
    description:
      "Weekly, 15-day, and monthly scooter rental packages in Bangalore with transparent GST-inclusive pricing.",
    url: `${getSiteUrl()}/browse`,
    siteName: SITE_NAME,
    locale: "en_IN",
    type: "website"
  }
};

export default function BrowseLayout({ children }: { children: React.ReactNode }) {
  return children;
}
