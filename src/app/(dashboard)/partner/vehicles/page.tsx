"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import PartnerPageHeader from "@/app/components/partner/PartnerPageHeader";
import StatusPill from "@/app/components/partner/StatusPill";
import Icon from "@/app/components/Icon";
import { getVehicleDisplayName, resolveVehicleThumbnail } from "@/lib/fleet/display";
import type { PartnerVehicleRow } from "@/lib/partner/service";

export default function PartnerVehiclesPage() {
  const [vehicles, setVehicles] = useState<PartnerVehicleRow[]>([]);
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [documentsByVehicleId, setDocumentsByVehicleId] = useState<Record<string, any[]>>({});
  const [docErrorByVehicleId, setDocErrorByVehicleId] = useState<Record<string, string>>({});
  const [loadingDocsId, setLoadingDocsId] = useState<string | null>(null);
  const docFetchSeq = useRef<Record<string, number>>({});

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
      const label = `${vehicle.id} ${vehicle.brand} ${vehicle.model} ${vehicle.registration_number ?? ""}`.toLowerCase();
      return label.includes(q);
    });
  }, [search, vehicles]);

  function toggleVehicle(vehicle: PartnerVehicleRow) {
    if (expandedId === vehicle.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(vehicle.id);
    setLoadingDocsId(vehicle.id);
    setDocErrorByVehicleId((current) => ({ ...current, [vehicle.id]: "" }));
    const seq = (docFetchSeq.current[vehicle.id] ?? 0) + 1;
    docFetchSeq.current[vehicle.id] = seq;
    fetch(`/api/vehicles/${vehicle.id}/documents`, { credentials: "include" })
      .then((res) => res.json())
      .then((json) => {
        if (docFetchSeq.current[vehicle.id] !== seq) return;
        if (json.ok) {
          setDocumentsByVehicleId((current) => ({
            ...current,
            [vehicle.id]: json.data.documents || []
          }));
          setDocErrorByVehicleId((current) => ({ ...current, [vehicle.id]: "" }));
        } else {
          setDocumentsByVehicleId((current) => ({
            ...current,
            [vehicle.id]: []
          }));
          setDocErrorByVehicleId((current) => ({
            ...current,
            [vehicle.id]: json?.error?.message ?? "Failed to load documents"
          }));
        }
      })
      .catch(() => {
        if (docFetchSeq.current[vehicle.id] !== seq) return;
        setDocumentsByVehicleId((current) => ({
          ...current,
          [vehicle.id]: []
        }));
        setDocErrorByVehicleId((current) => ({
          ...current,
          [vehicle.id]: "Failed to load documents"
        }));
      })
      .finally(() => {
        setLoadingDocsId((current) => (current === vehicle.id ? null : current));
      });
  }

  return (
    <>
      <PartnerPageHeader
        title="Vehicles"
        subtitle={`${vehicles.length} in your fleet`}
        actions={
          <div className="partner-search-wrap">
            <Icon name="search" className="w-4 h-4" />
            <input
              type="search"
              className="form-input partner-search-input"
              placeholder="Search vehicle, brand, reg no."
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
                <th className="partner-hide-mobile">Station</th>
                <th>Status</th>
                <th>Active</th>
                <th aria-label="Details" />
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="partner-empty-cell">
                    {loading ? "Loading…" : search ? "No vehicles found" : "Your fleet is being set up by the RBA team."}
                  </td>
                </tr>
              ) : (
                filtered.map((vehicle) => (
                  <Fragment key={vehicle.id}>
                    <tr>
                      <td>
                        <div className="flex items-center gap-3">
                          {(() => {
                            const thumb = resolveVehicleThumbnail(vehicle);
                            return (
                              <img
                                src={thumb.src}
                                alt={thumb.alt}
                                className="ops-vehicle-thumb"
                                loading="lazy"
                                onError={(event) => {
                                  event.currentTarget.src = thumb.fallback;
                                }}
                              />
                            );
                          })()}
                          <div>
                            <div className="partner-vehicle-name">
                              {getVehicleDisplayName(vehicle.id, {
                                brand: vehicle.brand,
                                model: vehicle.model
                              })}
                            </div>
                            <div className="text-xs text-muted">
                              {vehicle.registration_number || vehicle.id}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="partner-hide-mobile">{vehicle.station ?? "—"}</td>
                      <td>
                        <StatusPill status={vehicle.position} />
                      </td>
                      <td>
                        <span className={`badge badge-${vehicle.is_active ? "active" : "inactive"}`}>
                          {vehicle.is_active ? "Yes" : "No"}
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className={`partner-icon-btn${expandedId === vehicle.id ? " is-expanded" : ""}`}
                          aria-label={expandedId === vehicle.id ? "Hide details" : "Show details"}
                          aria-expanded={expandedId === vehicle.id}
                          onClick={() => toggleVehicle(vehicle)}
                        >
                          <Icon name="chevron-right" className="w-4 h-4 partner-chevron" />
                        </button>
                      </td>
                    </tr>
                    {expandedId === vehicle.id ? (
                      <tr className="partner-expand-row">
                        <td colSpan={5}>
                          <div className="partner-expand-grid">
                            <div className="partner-expand-section">
                              <h3 className="partner-expand-title">Details</h3>
                              <dl className="partner-detail-list">
                                <div>
                                  <dt>Category</dt>
                                  <dd>{vehicle.category}</dd>
                                </div>
                                <div>
                                  <dt>Brand / model</dt>
                                  <dd>
                                    {vehicle.brand} {vehicle.model}
                                  </dd>
                                </div>
                                <div>
                                  <dt>Registration</dt>
                                  <dd>{vehicle.registration_number || "—"}</dd>
                                </div>
                                <div>
                                  <dt>Chassis</dt>
                                  <dd>{vehicle.chassis_number || "—"}</dd>
                                </div>
                              </dl>
                            </div>
                            <div className="partner-expand-section">
                              <h3 className="partner-expand-title">Documents</h3>
                            {loadingDocsId === vehicle.id ? (
                                <div className="text-sm text-muted">Loading documents…</div>
                              ) : (
                                <>
                                  {docErrorByVehicleId[vehicle.id] ? (
                                    <div className="text-sm text-danger mb-2">
                                      {docErrorByVehicleId[vehicle.id]}
                                    </div>
                                  ) : null}
                                  {(documentsByVehicleId[vehicle.id] ?? []).length === 0 ? (
                                    docErrorByVehicleId[vehicle.id] ? null : (
                                      <div className="text-sm text-muted">No documents uploaded yet.</div>
                                    )
                                  ) : (
                                <ul className="partner-doc-list">
                                  {(documentsByVehicleId[vehicle.id] ?? []).map((doc: any) => (
                                    <li key={doc.id} className="partner-doc-item">
                                      <div>
                                        <div className="partner-doc-type">{doc.doc_type.toUpperCase()}</div>
                                        <div className="text-xs text-muted">
                                          Expires{" "}
                                          {doc.expires_at
                                            ? new Date(doc.expires_at).toLocaleDateString("en-IN")
                                            : "—"}
                                        </div>
                                      </div>
                                      <a
                                        href={doc.file_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="btn btn-secondary btn-sm"
                                      >
                                        View
                                      </a>
                                    </li>
                                  ))}
                                </ul>
                              )}
                                </>
                              )}
                            </div>
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
