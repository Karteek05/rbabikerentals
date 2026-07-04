"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Sidebar from "../../components/Sidebar";
import Icon from "../../components/Icon";
import { getVehicleDisplayName } from "@/lib/fleet/display";
import VehicleTrackingMap, { type TrackingVehicleItem } from "../../components/VehicleTrackingMap";

type RevenueData = {
  total_revenue?: number;
  pending_revenue?: number;
  bookings_count?: number;
  vehicles?: Array<{
    vehicle_id: string;
    revenue?: number;
    bookings?: number;
    utilization_pct?: number;
  }>;
  by_period?: Array<{ period: string; revenue: number; bookings: number }>;
};

const navItems = [
  { href: "/partner", icon: "chart", label: "Dashboard" },
  { href: "/partner#fleet", icon: "bike", label: "My Fleet" },
  { href: "/partner#revenue", icon: "money", label: "Revenue" },
  { href: "/partner#tracking", icon: "location", label: "Live Tracking" },
  { href: "/partner#maintenance", icon: "wrench", label: "Maintenance" },
  { href: "/partner#documents", icon: "document", label: "Documents" }
] as const;

const FLEET_MOCK = [
  { id: "veh_001", name: "Honda Activa 110", category: "Scooter", icon: "scooter", status: "active", nextService: "2026-06-18" },
  { id: "veh_002", name: "Honda Dio 110", category: "Scooter", icon: "scooter", status: "active", nextService: "2026-06-20" },
  { id: "veh_003", name: "TVS Jupiter 125", category: "Scooter", icon: "scooter", status: "active", nextService: "2026-06-22" }
] as const;

export default function PartnerDashboardPage() {
  const [partnerId, setPartnerId] = useState("partner_001");
  const [revenue, setRevenue] = useState<RevenueData | null>(null);
  const [trackingItems, setTrackingItems] = useState<TrackingVehicleItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [blockStart, setBlockStart] = useState("");
  const [blockEnd, setBlockEnd] = useState("");
  const [blockReason, setBlockReason] = useState("scheduled_maintenance");
  const [blockVehicle, setBlockVehicle] = useState("veh_001");

  const fetchInit = useMemo(
    () => ({
      credentials: "include" as const,
      headers: {
        "content-type": "application/json"
      }
    }),
    []
  );

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  const refreshDashboard = useCallback(async () => {
    setError(null);
    setLoading("refresh");
    try {
      const [revenueRes, trackingRes] = await Promise.all([
        fetch("/api/partner/revenue", { ...fetchInit }),
        fetch("/api/partner/tracking", { ...fetchInit })
      ]);
      const [revenueJson, trackingJson] = await Promise.all([
        revenueRes.json(),
        trackingRes.json()
      ]);
      if (!revenueRes.ok || !revenueJson.ok) {
        setError(revenueJson?.error?.message ?? "Failed to fetch revenue");
        return;
      }
      if (!trackingRes.ok || !trackingJson.ok) {
        setError(trackingJson?.error?.message ?? "Failed to fetch tracking data");
        return;
      }
      setRevenue(revenueJson.data);
      setTrackingItems(trackingJson.data.items ?? []);
    } finally {
      setLoading(null);
    }
  }, [fetchInit]);

  useEffect(() => {
    refreshDashboard().catch((e) => setError(String(e)));
  }, [refreshDashboard]);

  useEffect(() => {
    const start = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
    const end = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    setBlockStart(start.toISOString().slice(0, 16));
    setBlockEnd(end.toISOString().slice(0, 16));
  }, []);

  async function createBlockWindow() {
    setError(null);
    if (!blockStart || !blockEnd) {
      setError("Please select both start and end dates for the block window.");
      return;
    }
    setLoading("block");
    try {
      const res = await fetch(`/api/vehicles/${blockVehicle}/block`, {
        method: "POST",
        ...fetchInit,
        body: JSON.stringify({
          starts_at: new Date(blockStart).toISOString(),
          ends_at: new Date(blockEnd).toISOString(),
          reason: blockReason
        })
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json?.error?.message ?? "Failed to create block window");
      } else {
        showSuccess(`Vehicle ${blockVehicle} blocked successfully.`);
        await refreshDashboard();
      }
    } finally {
      setLoading(null);
    }
  }

  const totalRevenue = revenue?.total_revenue ?? 0;
  const totalBookings = revenue?.bookings_count ?? 0;
  const vehicleRevenues = revenue?.vehicles ?? [];
  const trackingWithLabels = trackingItems.map((item) => {
    const vehicle = FLEET_MOCK.find((fleetVehicle) => fleetVehicle.id === item.vehicle_id);
    return {
      ...item,
      label: vehicle?.name ?? item.vehicle_id
    };
  });

  return (
    <div className="dashboard-layout">
      <Sidebar role="partner" navItems={[...navItems]} userName={partnerId} />

      <div className="dashboard-content">
        <div className="flex-between mb-6">
          <div className="page-header" style={{ marginBottom: 0 }}>
            <h1 className="inline-flex items-center gap-2">
              <Icon name="chart" className="w-5 h-5" />
              Partner Dashboard
            </h1>
            <p>Fleet management, revenue analytics, and maintenance scheduling.</p>
          </div>

          <div className="flex gap-3" style={{ alignItems: "flex-end" }}>
            <div className="form-group" style={{ marginBottom: 0, width: 200 }}>
              <label className="form-label">Partner ID</label>
              <select className="form-input form-select" value={partnerId} onChange={(e) => setPartnerId(e.target.value)}>
                <option value="partner_001">partner_001</option>
              </select>
            </div>
            <button className="btn btn-secondary" onClick={refreshDashboard} disabled={!!loading}>
              {loading === "refresh" ? <span className="spinner" /> : <Icon name="refresh" className="w-4 h-4" />} Refresh
            </button>
          </div>
        </div>

        {error && (
          <div className="error-banner inline-flex items-center gap-2">
            <Icon name="warning" className="w-4 h-4" />
            {error}
          </div>
        )}
        {successMsg && (
          <div className="success-banner inline-flex items-center gap-2">
            <Icon name="checkCircle" className="w-4 h-4" />
            {successMsg}
          </div>
        )}

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">Total Revenue</div>
            <div className="stat-value accent" style={{ fontSize: "1.6rem" }}>
              ₹{totalRevenue.toLocaleString()}
            </div>
            <div className="stat-sub">All time</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Total Bookings</div>
            <div className="stat-value">{totalBookings}</div>
            <div className="stat-sub">Across fleet</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Active Vehicles</div>
            <div className="stat-value">{FLEET_MOCK.length}</div>
            <div className="stat-sub">Deployed in Bengaluru</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Pending Payout</div>
            <div className="stat-value accent">₹{(revenue?.pending_revenue ?? 0).toLocaleString()}</div>
            <div className="stat-sub">Processing</div>
          </div>
        </div>

        <div id="fleet" className="mb-6">
          <div className="section-header">
            <div>
              <h2 className="inline-flex items-center gap-2">
                <Icon name="bike" className="w-5 h-5" />
                Fleet Overview
              </h2>
              <p>{FLEET_MOCK.length} vehicles in your portfolio</p>
            </div>
          </div>

          <div className="vehicle-grid">
            {FLEET_MOCK.map((vehicle) => {
              const vRev = vehicleRevenues.find((v) => v.vehicle_id === vehicle.id);
              return (
                <div key={vehicle.id} className="vehicle-card">
                  <div className="vehicle-card-image">
                    <Icon name={vehicle.icon} className="w-8 h-8" />
                  </div>
                  <div className="vehicle-card-body">
                    <div className="vehicle-card-name">{vehicle.name}</div>
                    <div className="vehicle-card-category">{vehicle.category}</div>
                    <div className="vehicle-specs">
                      <span className={`badge badge-${vehicle.status}`}>{vehicle.status}</span>
                      <span className="spec-chip">Service: {new Date(vehicle.nextService).toLocaleDateString("en-IN")}</span>
                    </div>
                    {vRev && (
                      <div style={{ marginBottom: 12 }}>
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr",
                            gap: 8,
                            background: "var(--surface-low)",
                            borderRadius: "var(--radius-md)",
                            padding: "10px 12px"
                          }}
                        >
                          <div>
                            <div className="text-xs text-muted">Revenue</div>
                            <div style={{ fontWeight: 700, color: "var(--primary)", fontSize: "1rem" }}>₹{(vRev.revenue ?? 0).toLocaleString()}</div>
                          </div>
                          <div>
                            <div className="text-xs text-muted">Bookings</div>
                            <div style={{ fontWeight: 700 }}>{vRev.bookings ?? 0}</div>
                          </div>
                        </div>
                      </div>
                    )}
                    <button
                      className="btn btn-secondary btn-sm w-full"
                      onClick={() => setBlockVehicle(vehicle.id)}
                      style={{ borderColor: blockVehicle === vehicle.id ? "var(--primary-container)" : undefined }}
                    >
                      {blockVehicle === vehicle.id ? "Selected for Block" : "Schedule Maintenance"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div id="revenue" className="card mb-6">
          <div className="section-header">
            <div>
              <h2 className="inline-flex items-center gap-2">
                <Icon name="money" className="w-5 h-5" />
                Revenue Breakdown
              </h2>
              <p>Per-vehicle revenue summary</p>
            </div>
          </div>

          {vehicleRevenues.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon inline-flex items-center justify-center">
                <Icon name="money" className="w-6 h-6" />
              </div>
              <p>No revenue data available yet.</p>
            </div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Vehicle</th>
                    <th>Bookings</th>
                    <th>Revenue</th>
                    <th>Utilization</th>
                    <th>Avg / Booking</th>
                  </tr>
                </thead>
                <tbody>
                  {vehicleRevenues.map((v) => (
                    <tr key={v.vehicle_id}>
                      <td className="td-id">
                        <div style={{ fontWeight: 700 }}>{getVehicleDisplayName(v.vehicle_id)}</div>
                        <div className="text-xs text-muted">{v.vehicle_id}</div>
                      </td>
                      <td>{v.bookings ?? 0}</td>
                      <td style={{ fontWeight: 700, color: "var(--primary)" }}>₹{(v.revenue ?? 0).toLocaleString()}</td>
                      <td>
                        {v.utilization_pct !== undefined ? (
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div
                              style={{
                                flex: 1,
                                height: 4,
                                background: "var(--surface-bright)",
                                borderRadius: 2,
                                overflow: "hidden"
                              }}
                            >
                              <div
                                style={{
                                  height: "100%",
                                  width: `${Math.min(v.utilization_pct, 100)}%`,
                                  background:
                                    "linear-gradient(90deg, var(--primary) 0%, var(--primary-container) 100%)",
                                  borderRadius: 2
                                }}
                              />
                            </div>
                            <span className="text-xs text-muted">{v.utilization_pct}%</span>
                          </div>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="text-muted">
                        {v.bookings && v.revenue && v.bookings > 0
                          ? `₹${Math.round(v.revenue / v.bookings).toLocaleString()}`
                          : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {revenue && vehicleRevenues.length === 0 && (
            <div style={{ marginTop: 12 }}>
              <div className="form-label mb-2">Raw Revenue Data (API Response)</div>
              <pre
                style={{
                  background: "var(--surface-lowest)",
                  borderRadius: "var(--radius-md)",
                  padding: 16,
                  fontSize: "0.78rem",
                  color: "var(--on-surface-muted)",
                  overflow: "auto",
                  maxHeight: 240
                }}
              >
                {JSON.stringify(revenue, null, 2)}
              </pre>
            </div>
          )}
        </div>

        <div id="tracking" className="mb-6">
          <VehicleTrackingMap
            title="Live Tracking"
            subtitle="Current GPS position for your fleet in Bengaluru."
            items={trackingWithLabels}
          />
        </div>

        <div id="maintenance" className="card">
          <div className="section-header">
            <div>
              <h2 className="inline-flex items-center gap-2">
                <Icon name="wrench" className="w-5 h-5" />
                Schedule Maintenance Block
              </h2>
              <p>Block a vehicle from bookings for service or planned downtime.</p>
            </div>
          </div>

          <div className="form-row mb-4">
            <div className="form-group">
              <label className="form-label">Vehicle</label>
              <select className="form-input form-select" value={blockVehicle} onChange={(e) => setBlockVehicle(e.target.value)}>
                {FLEET_MOCK.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.id} - {v.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Block Start</label>
              <input type="datetime-local" className="form-input" value={blockStart} onChange={(e) => setBlockStart(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Block End</label>
              <input type="datetime-local" className="form-input" value={blockEnd} onChange={(e) => setBlockEnd(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Reason</label>
              <select className="form-input form-select" value={blockReason} onChange={(e) => setBlockReason(e.target.value)}>
                <option value="scheduled_maintenance">Scheduled Maintenance</option>
                <option value="owner_use">Owner Use</option>
                <option value="repair">Repair</option>
                <option value="inspection">Inspection</option>
                <option value="document_renewal">Document Renewal</option>
              </select>
            </div>
          </div>

          <button className="btn btn-primary" onClick={createBlockWindow} disabled={!!loading}>
            {loading === "block" ? <span className="spinner" /> : <Icon name="wrench" className="w-4 h-4" />} Create Maintenance Block
          </button>
        </div>
      </div>
    </div>
  );
}
