import type { Metadata } from "next";
import HomePage from "./HomePage.client";
import { DEFAULT_SEO, SITE_NAME, getSiteUrl } from "@/lib/seo/site";

const siteUrl = getSiteUrl();

export const metadata: Metadata = {
  alternates: {
    canonical: siteUrl
  },
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: siteUrl,
    siteName: SITE_NAME,
    title: DEFAULT_SEO.title,
    description: DEFAULT_SEO.description
  }
};

export default function Page() {
  return <HomePage />;
}
