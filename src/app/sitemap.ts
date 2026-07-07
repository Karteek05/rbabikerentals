import type { MetadataRoute } from "next";
import { PUBLIC_INDEXABLE_ROUTES, getSiteUrl } from "@/lib/seo/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getSiteUrl();
  const lastModified = new Date();

  return PUBLIC_INDEXABLE_ROUTES.map((route) => ({
    url: `${siteUrl}${route}`,
    lastModified,
    changeFrequency: route === "" || route === "/browse" ? "daily" : "weekly",
    priority: route === "" ? 1 : route.startsWith("/book/") ? 0.8 : 0.7
  }));
}
