"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import PartnerPageHeader from "@/app/components/partner/PartnerPageHeader";
import StatusPill from "@/app/components/partner/StatusPill";
import Icon from "@/app/components/Icon";
import { getVehicleDisplayName } from "@/lib/fleet/display";
import type { PartnerVehicleRow } from "@/lib/partner/service";

export default function PartnerVehiclesPage() {
  const [vehicles, setVehicles] = useState<PartnerVehicleRow[]>([]);
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loadVehicles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/partner/vehicles", { credentials: "include" });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json?.error?.message ?? "Failed to load vehicles");
        return;
      }
      setVehicles(json.data.items ?? []);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadVehicles();
  }, [loadVehicles]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return vehicles;
    return vehicles.filter((vehicle) => {
      const label = `${vehicle.id} ${vehicle.brand} ${vehicle.model}`.toLowerCase();
      return label.includes(q);
    });
  }, [search, vehicles]);

  return (
    <>
      <PartnerPageHeader
        title="Vehicles"
        actions={
          <div className="partner-search-wrap">
            <Icon name="search" className="w-4 h-4" />
            <input
              type="search"
              className="form-input partner-search-input"
              placeholder="Search by vehicle id, brand, or model"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        }
      />

      {error ? <div className="error-banner mb-4">{error}</div> : null}
      {loading && !vehicles.length ? <div className="text-sm text-muted mb-4">Loading vehicles…</div> : null}

      <div className="card partner-table-card">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Vehicle</th>
                <th>Partner</th>
                <th>Station</th>
                <th>Position</th>
                <th>Active</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="partner-empty-cell">
                    {loading ? "Loading…" : search ? "No vehicles found" : "Your fleet is being set up by the RBA team."}
                  </td>
                </tr>
              ) : (
                filtered.map((vehicle) => (
                  <Fragment key={vehicle.id}>
                    <tr>
                      <td>
                        <div style={{ fontWeight: 700 }}>
                          {getVehicleDisplayName(vehicle.id, {
                            brand: vehicle.brand,
                            model: vehicle.model
                          })}
                        </div>
                        <div className="text-xs text-muted">{vehicle.id}</div>
                      </td>
                      <td>{vehicle.partner_name}</td>
                      <td>{vehicle.station ?? "—"}</td>
                      <td>
                        <StatusPill status={vehicle.position} />
                      </td>
                      <td>
                        <span className={`badge badge-${vehicle.is_active ? "active" : "inactive"}`}>
                          {vehicle.is_active ? "yes" : "no"}
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="partner-icon-btn"
                          aria-label="View details"
                          onClick={() =>
                            setExpandedId((current) => (current === vehicle.id ? null : vehicle.id))
                          }
                        >
                          <Icon name="chevron-right" className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                    {expandedId === vehicle.id ? (
                      <tr className="partner-expand-row">
                        <td colSpan={6}>
                          <div className="partner-expand-content">
                            <span>Category: {vehicle.category}</span>
                            <span>Brand: {vehicle.brand}</span>
                            <span>Model: {vehicle.model}</span>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
