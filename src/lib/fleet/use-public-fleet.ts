import { useEffect, useState } from "react";
import { PUBLIC_FLEET, type PublicFleetVehicle } from "@/lib/fleet/catalog";

export function usePublicFleet() {
  const [fleet, setFleet] = useState<PublicFleetVehicle[]>(PUBLIC_FLEET);

  useEffect(() => {
    let active = true;
    fetch("/api/fleet/catalog", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((json) => {
        if (active && json?.ok && Array.isArray(json.data?.items)) {
          setFleet(json.data.items as PublicFleetVehicle[]);
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  return fleet;
}
