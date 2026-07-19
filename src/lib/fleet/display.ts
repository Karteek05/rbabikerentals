import { PUBLIC_FLEET_BY_ID } from "@/lib/fleet/catalog";

export function getVehicleDisplayName(
  vehicleId: string,
  fallback?: { brand?: string; model?: string }
) {
  const catalog = PUBLIC_FLEET_BY_ID[vehicleId];
  if (catalog) {
    return `${catalog.brand} ${catalog.model}`;
  }
  if (fallback?.brand && fallback?.model) {
    return `${fallback.brand} ${fallback.model}`;
  }
  if (fallback?.brand) return fallback.brand;
  return vehicleId;
}

export function getVehicleCatalogImage(
  vehicleId: string,
  fallback?: { brand?: string; model?: string }
) {
  const catalog = PUBLIC_FLEET_BY_ID[vehicleId];
  if (catalog) {
    return { image: catalog.image, fallbackImage: catalog.fallbackImage, alt: catalog.imageAlt };
  }

  const brand = (fallback?.brand ?? "").toLowerCase();
  const model = (fallback?.model ?? "").toLowerCase();
  if (brand.includes("honda") && model.includes("dio")) {
    const dio = PUBLIC_FLEET_BY_ID.veh_002;
    return { image: dio.image, fallbackImage: dio.fallbackImage, alt: dio.imageAlt };
  }
  if (brand.includes("honda") && model.includes("activa")) {
    const activa = PUBLIC_FLEET_BY_ID.veh_001;
    return { image: activa.image, fallbackImage: activa.fallbackImage, alt: activa.imageAlt };
  }
  if (brand.includes("tvs") && model.includes("jupiter")) {
    const catalog = PUBLIC_FLEET_BY_ID.veh_003;
    return { image: catalog.image, fallbackImage: catalog.fallbackImage, alt: catalog.imageAlt };
  }
  if (brand.includes("tvs") && model.includes("raider")) {
    return {
      image: "/images/services/raider.svg",
      fallbackImage: "/images/services/raider.svg",
      alt: "TVS Raider bike illustration"
    };
  }
  if (brand.includes("tvs") && (model.includes("apache") || model.includes("sport"))) {
    return {
      image: "/images/services/raider.svg",
      fallbackImage: "/images/services/raider.svg",
      alt: "TVS bike illustration"
    };
  }
  if (brand.includes("honda") && (model.includes("fleet") || model.includes("activa"))) {
    const activa = PUBLIC_FLEET_BY_ID.veh_001;
    return { image: activa.image, fallbackImage: activa.fallbackImage, alt: activa.imageAlt };
  }
  if (brand.includes("honda")) {
    const activa = PUBLIC_FLEET_BY_ID.veh_001;
    return { image: activa.image, fallbackImage: activa.fallbackImage, alt: activa.imageAlt };
  }
  if (brand.includes("tvs")) {
    const jupiter = PUBLIC_FLEET_BY_ID.veh_003;
    return { image: jupiter.image, fallbackImage: jupiter.fallbackImage, alt: jupiter.imageAlt };
  }

  const fallbackCatalog = PUBLIC_FLEET_BY_ID.veh_001;
  return fallbackCatalog
    ? {
        image: fallbackCatalog.image,
        fallbackImage: fallbackCatalog.fallbackImage,
        alt: fallbackCatalog.imageAlt
      }
    : null;
}

export function formatBookingReference(bookingId: string) {
  const short = bookingId.replace(/^booking_/, "").slice(0, 8).toUpperCase();
  return `RBA-${short}`;
}

export function resolveVehicleThumbnail(vehicle: {
  id: string;
  catalog_vehicle_id?: string | null;
  brand: string;
  model: string;
  image_urls?: string[];
}) {
  const catalogId = vehicle.catalog_vehicle_id ?? vehicle.id;
  const visual = getVehicleCatalogImage(catalogId, {
    brand: vehicle.brand,
    model: vehicle.model
  });
  const fallback = visual?.fallbackImage ?? "/images/services/activa-6g.svg";
  const uploaded = vehicle.image_urls?.find((url) => url && !url.startsWith("local:"));
  const src = uploaded ?? visual?.image ?? fallback;
  return {
    src,
    fallback,
    alt: visual?.alt ?? `${vehicle.brand} ${vehicle.model}`
  };
}
