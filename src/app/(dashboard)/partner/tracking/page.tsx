"use client";

import { useCallback, useEffect, useState } from "react";
import PartnerPageHeader from "@/app/components/partner/PartnerPageHeader";
import Icon from "@/app/components/Icon";
import VehicleTrackingMap, { type TrackingVehicleItem } from "@/app/components/VehicleTrackingMap";import { getVehicleDisplayName } from "@/lib/fleet/display";
import type { PartnerVehicleRow } from "@/lib/partner/service";

export default function PartnerTrackingPage() {
  const [trackingItems, setTrackingItems] = useState<TrackingVehicleItem[]>([]);
  const [vehicles, setVehicles] = useState<PartnerVehicleRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [trackingRes, vehiclesRes] = await Promise.all([
        fetch("/api/partner/tracking", { credentials: "include" }),
        fetch("/api/partner/vehicles", { credentials: "include" })
      ]);
      const [trackingJson, vehiclesJson] = await Promise.all([
        trackingRes.json(),
        vehiclesRes.json()
      ]);
      if (!trackingRes.ok || !trackingJson.ok) {
        setError(trackingJson?.error?.message ?? "Failed to fetch tracking data");
        return;
      }
      if (!vehiclesRes.ok || !vehiclesJson.ok) {
        setError(vehiclesJson?.error?.message ?? "Failed to fetch vehicles");
        return;
      }
      setVehicles(vehiclesJson.data.items ?? []);
      setTrackingItems(trackingJson.data.items ?? []);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const vehicleMap = new Map(
    vehicles.map((vehicle) => [
      vehicle.id,
      getVehicleDisplayName(vehicle.id, { brand: vehicle.brand, model: vehicle.model })
    ])
  );

  const itemsWithLabels = trackingItems.map((item) => ({
    ...item,
    label: vehicleMap.get(item.vehicle_id) ?? item.vehicle_id
  }));

  return (
    <>
      <PartnerPageHeader
        title="Live Tracking"
        subtitle="Current GPS position for your fleet in Bengaluru."
        actions={
          <button type="button" className="btn btn-secondary" onClick={refresh} disabled={loading}>
            {loading ? <span className="spinner" /> : <Icon name="refresh" className="w-4 h-4" />}
            Refresh
          </button>
        }
      />

      {error ? <div className="error-banner mb-4">{error}</div> : null}

      <VehicleTrackingMap
        title="Fleet Map"
        subtitle="Select a vehicle to inspect its latest ping."
        items={itemsWithLabels}
      />
    </>
  );
}
