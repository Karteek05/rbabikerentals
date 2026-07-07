import { PUBLIC_FLEET } from "@/lib/fleet/catalog";
import { COMPANY } from "@/lib/legal/company";
import { getSiteUrl } from "@/lib/seo/site";

export default function LocalBusinessJsonLd() {
  const siteUrl = getSiteUrl();

  const localBusiness = {
    "@context": "https://schema.org",
    "@type": "AutoRental",
    name: COMPANY.brand,
    url: siteUrl,
    email: COMPANY.supportEmail,
    areaServed: {
      "@type": "City",
      name: "Bengaluru",
      alternateName: "Bangalore",
      containedInPlace: {
        "@type": "State",
        name: "Karnataka"
      }
    },
    address: {
      "@type": "PostalAddress",
      addressLocality: "Bengaluru",
      addressRegion: "Karnataka",
      addressCountry: "IN",
      streetAddress: "Sarjapur Road"
    },
    description:
      "Scooter and bike rentals in Bengaluru with weekly, 15-day, and monthly GST-inclusive packages.",
    priceRange: "₹₹",
    knowsAbout: [
      "bike rental",
      "scooter rental",
      "two wheeler rental",
      "Bengaluru bike rental",
      "Bangalore scooter rental"
    ],
    makesOffer: PUBLIC_FLEET.map((vehicle) => ({
      "@type": "Offer",
      name: `${vehicle.brand} ${vehicle.model} rental`,
      category: "Vehicle rental",
      areaServed: "Bengaluru",
      url: `${siteUrl}/book/${vehicle.id}`
    }))
  };

  const website = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: COMPANY.brand,
    url: siteUrl,
    inLanguage: "en-IN",
    potentialAction: {
      "@type": "SearchAction",
      target: `${siteUrl}/browse?q={search_term_string}`,
      "query-input": "required name=search_term_string"
    }
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusiness) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(website) }}
      />
    </>
  );
}
