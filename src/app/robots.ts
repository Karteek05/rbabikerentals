import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/seo/site";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/admin",
          "/admin-login",
          "/customer",
          "/partner",
          "/partner-login",
          "/staff-login",
          "/dashboard-access",
          "/profile",
          "/my-bookings",
          "/kyc",
          "/login",
          "/signup",
          "/forgot-password",
          "/reset-password"
        ]
      }
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl
  };
}
