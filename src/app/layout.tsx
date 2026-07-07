import type { Metadata } from "next";
import { Suspense } from "react";
import "./globals.css";
import Navbar from "@/app/components/Navbar";
import Footer from "@/app/components/Footer";
import LocalBusinessJsonLd from "@/app/components/LocalBusinessJsonLd";
import { DEFAULT_SEO, SITE_NAME, getSiteUrl } from "@/lib/seo/site";

const siteUrl = getSiteUrl();

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: `${DEFAULT_SEO.title} | ${SITE_NAME}`,
    template: `%s | ${SITE_NAME}`
  },
  description: DEFAULT_SEO.description,
  keywords: [...DEFAULT_SEO.keywords],
  applicationName: SITE_NAME,
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
  },
  twitter: {
    card: "summary_large_image",
    title: DEFAULT_SEO.title,
    description: DEFAULT_SEO.description
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1
    }
  },
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
    apple: "/icon.svg"
  }
};

export default function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-IN">
      <body className="bg-[color:var(--color-paper)] text-[color:var(--color-ink)] antialiased">
        <LocalBusinessJsonLd />
        <Suspense fallback={null}>
          <Navbar />
        </Suspense>
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
