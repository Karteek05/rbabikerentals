import type { Metadata } from "next";
import { PUBLIC_FLEET_BY_ID } from "@/lib/fleet/catalog";
import { DEFAULT_SEO, SITE_NAME, getSiteUrl } from "@/lib/seo/site";

type LayoutProps = {
  children: React.ReactNode;
  params: Promise<{ vehicleId: string }>;
};

export async function generateMetadata({ params }: Pick<LayoutProps, "params">): Promise<Metadata> {
  const { vehicleId } = await params;
  const vehicle = PUBLIC_FLEET_BY_ID[vehicleId];
  const siteUrl = getSiteUrl();
  const canonical = `${siteUrl}/book/${vehicleId}`;

  if (!vehicle) {
    return {
      title: "Book a scooter in Bengaluru",
      alternates: { canonical }
    };
  }

  const title = `Rent ${vehicle.brand} ${vehicle.model} in Bengaluru`;
  const description = `Book ${vehicle.brand} ${vehicle.model} scooter rental in Bengaluru (Bangalore). Weekly, 15-day, and monthly GST-inclusive packages from ${siteUrl}.`;

  return {
    title,
    description,
    keywords: [
      ...DEFAULT_SEO.keywords,
      `${vehicle.brand} ${vehicle.model} rental bangalore`,
      `${vehicle.model.toLowerCase()} rental bengaluru`
    ],
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: SITE_NAME,
      locale: "en_IN",
      type: "website"
    }
  };
}

export default function BookVehicleLayout({ children }: LayoutProps) {
  return children;
}
