"use client";

import { useEffect, useMemo, useState } from "react";
import Icon from "./Icon";

export interface TrackingVehicleItem {
  vehicle_id: string;
  latitude: number;
  longitude: number;
  speed_kmph?: number | null;
  heading_deg?: number | null;
  source: string;
  updated_at: string;
  label?: string;
}

interface VehicleTrackingMapProps {
  title: string;
  subtitle: string;
  items: TrackingVehicleItem[];
}

function formatTime(value: string) {
  try {
    return new Date(value).toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short"
    });
  } catch {
    return value;
  }
}

export default function VehicleTrackingMap({
  title,
  subtitle,
  items
}: VehicleTrackingMapProps) {
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>("");

  useEffect(() => {
    if (!items.length) {
      setSelectedVehicleId("");
      return;
    }
    if (!selectedVehicleId || !items.some((item) => item.vehicle_id === selectedVehicleId)) {
      setSelectedVehicleId(items[0].vehicle_id);
    }
  }, [items, selectedVehicleId]);

  const selected = useMemo(
    () => items.find((item) => item.vehicle_id === selectedVehicleId) ?? items[0],
    [items, selectedVehicleId]
  );

  const embedUrl = useMemo(() => {
    if (!selected) return null;
    const delta = 0.01;
    const left = (selected.longitude - delta).toFixed(6);
    const right = (selected.longitude + delta).toFixed(6);
    const top = (selected.latitude + delta).toFixed(6);
    const bottom = (selected.latitude - delta).toFixed(6);
    const marker = `${selected.latitude.toFixed(6)}%2C${selected.longitude.toFixed(6)}`;
    return `https://www.openstreetmap.org/export/embed.html?bbox=${left}%2C${bottom}%2C${right}%2C${top}&layer=mapnik&marker=${marker}`;
  }, [selected]);

  return (
    <div className="card">
      <div className="section-header">
        <div>
          <h2 className="inline-flex items-center gap-2">
            <Icon name="location" className="w-5 h-5" />
            {title}
          </h2>
          <p>{subtitle}</p>
        </div>
      </div>

      {items.length === 0 || !selected ? (
        <div className="empty-state">
          <div className="empty-state-icon inline-flex items-center justify-center">
            <Icon name="location" className="w-6 h-6" />
          </div>
          <p>No live tracking data available yet.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 14 }}>
          <div className="form-group" style={{ maxWidth: 320 }}>
            <label className="form-label">Tracked Vehicle</label>
            <select
              className="form-input form-select"
              value={selected.vehicle_id}
              onChange={(event) => setSelectedVehicleId(event.target.value)}
            >
              {items.map((item) => (
                <option key={item.vehicle_id} value={item.vehicle_id}>
                  {item.label ? `${item.label} (${item.vehicle_id})` : item.vehicle_id}
                </option>
              ))}
            </select>
          </div>

          <div
            style={{
              border: "1px solid rgba(0,0,0,0.1)",
              borderRadius: "var(--radius-md)",
              overflow: "hidden",
              minHeight: 280
            }}
          >
            {embedUrl && (
              <iframe
                title={`Map for ${selected.vehicle_id}`}
                src={embedUrl}
                width="100%"
                height="320"
                style={{ border: 0 }}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            )}
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
              gap: 10
            }}
          >
            <div className="stat-card" style={{ padding: 12 }}>
              <div className="stat-label">Vehicle ID</div>
              <div className="stat-value" style={{ fontSize: "1.05rem", marginTop: 6 }}>
                {selected.vehicle_id}
              </div>
            </div>
            <div className="stat-card" style={{ padding: 12 }}>
              <div className="stat-label">Coordinates</div>
              <div className="stat-value" style={{ fontSize: "1.05rem", marginTop: 6 }}>
                {selected.latitude.toFixed(5)}, {selected.longitude.toFixed(5)}
              </div>
            </div>
            <div className="stat-card" style={{ padding: 12 }}>
              <div className="stat-label">Speed</div>
              <div className="stat-value" style={{ fontSize: "1.05rem", marginTop: 6 }}>
                {selected.speed_kmph ?? 0} km/h
              </div>
            </div>
            <div className="stat-card" style={{ padding: 12 }}>
              <div className="stat-label">Last Ping</div>
              <div className="stat-value" style={{ fontSize: "1.05rem", marginTop: 6 }}>
                {formatTime(selected.updated_at)}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
