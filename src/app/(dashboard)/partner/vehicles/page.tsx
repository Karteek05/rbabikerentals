"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import PartnerPageHeader from "@/app/components/partner/PartnerPageHeader";
import StatusPill from "@/app/components/partner/StatusPill";
import Icon from "@/app/components/Icon";
import { getVehicleDisplayName, resolveVehicleThumbnail } from "@/lib/fleet/display";
import type { PartnerVehicleRow } from "@/lib/partner/service";
import { useToast } from "@/app/components/ToastProvider";

type VehicleBlockWindow = {
  id: string;
  vehicle_id: string;
  starts_at: string;
  ends_at: string;
  reason: string;
};

function localDateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}


export default function PartnerVehiclesPage() {
  const showToast = useToast();
  const [vehicles, setVehicles] = useState<PartnerVehicleRow[]>([]);
  const [blocks, setBlocks] = useState<VehicleBlockWindow[]>([]);
  const [blockStart, setBlockStart] = useState("");
  const [blockEnd, setBlockEnd] = useState("");
  const [blockReason, setBlockReason] = useState("");
  const [blockError, setBlockError] = useState("");
  const [blockBusy, setBlockBusy] = useState(false);
  const [blocksLoading, setBlocksLoading] = useState(false);
  const [removingBlockId, setRemovingBlockId] = useState<string | null>(null);
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
  const loadBlocks = useCallback(async () => {
    setBlocksLoading(true);
    try {
      const response = await fetch("/api/partner/vehicle-blocks", { credentials: "include" });
      const json = await response.json();
      if (!response.ok || !json.ok) throw new Error(json?.error?.message ?? "Failed to load maintenance windows");
      setBlocks(json.data.items ?? []);
    } catch (loadError) {
      setBlockError(loadError instanceof Error ? loadError.message : "Failed to load maintenance windows");
    } finally {
      setBlocksLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBlocks();
  }, [loadBlocks]);

  async function createBlock(event: React.FormEvent<HTMLFormElement>, vehicleId: string) {
    event.preventDefault();
    setBlockError("");
    const startsAt = new Date(blockStart);
    const endsAt = new Date(blockEnd);
    if (!blockStart || !blockEnd || Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
      setBlockError("Enter a valid start and end date.");
      return;
    }
    if (endsAt <= startsAt) {
      setBlockError("End date and time must be after the start.");
      return;
    }
    if (!blockReason.trim()) {
      setBlockError("Enter a reason for the maintenance block.");
      return;
    }
    setBlockBusy(true);
    try {
      const response = await fetch(`/api/vehicles/${vehicleId}/block`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ starts_at: startsAt.toISOString(), ends_at: endsAt.toISOString(), reason: blockReason.trim() })
      });
      const json = await response.json();
      if (!response.ok || !json.ok) throw new Error(json?.error?.message ?? "Unable to create maintenance window");
      setBlockStart("");
      setBlockEnd("");
      setBlockReason("");
      showToast({ title: "Maintenance block created", message: "The vehicle will be unavailable during the selected period." });
      await loadBlocks();
    } catch (createError) {
      setBlockError(createError instanceof Error ? createError.message : "Unable to create maintenance window");
    } finally {
      setBlockBusy(false);
    }
  }

  async function removeBlock(block: VehicleBlockWindow) {
    if (!window.confirm("Remove this maintenance block? The vehicle will become available again during this period.")) return;
    setRemovingBlockId(block.id);
    setBlockError("");
    try {
      const response = await fetch(`/api/vehicles/${block.vehicle_id}/block-windows/${block.id}`, {
        method: "DELETE",
        credentials: "include"
      });
      const json = await response.json();
      if (!response.ok || !json.ok) throw new Error(json?.error?.message ?? "Unable to remove maintenance window");
      setBlocks((current) => current.filter((item) => item.id !== block.id));
      showToast({ title: "Maintenance block removed", message: "The vehicle is available again during that period." });
    } catch (removeError) {
      setBlockError(removeError instanceof Error ? removeError.message : "Unable to remove maintenance window");
    } finally {
      setRemovingBlockId(null);
    }
  }

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
                            <div className="partner-expand-section">
                              <h3 className="partner-expand-title">Maintenance availability</h3>
                              <form className="grid gap-3 mb-4" onSubmit={(event) => createBlock(event, vehicle.id)}>
                                <label className="text-sm" htmlFor={`maintenance-start-${vehicle.id}`}>
                                  Starts
                                  <input id={`maintenance-start-${vehicle.id}`} className="form-input mt-1" type="datetime-local" value={blockStart} onChange={(event) => setBlockStart(event.target.value)} required />
                                </label>
                                <label className="text-sm" htmlFor={`maintenance-end-${vehicle.id}`}>
                                  Ends
                                  <input id={`maintenance-end-${vehicle.id}`} className="form-input mt-1" type="datetime-local" value={blockEnd} onChange={(event) => setBlockEnd(event.target.value)} required />
                                </label>
                                <label className="text-sm" htmlFor={`maintenance-reason-${vehicle.id}`}>
                                  Reason
                                  <input id={`maintenance-reason-${vehicle.id}`} className="form-input mt-1" value={blockReason} onChange={(event) => setBlockReason(event.target.value)} maxLength={240} required />
                                </label>
                                <button className="btn btn-primary btn-sm" type="submit" disabled={blockBusy}>
                                  {blockBusy ? "Saving…" : "Block vehicle"}
                                </button>
                              </form>
                              {blockError ? <p className="text-sm text-danger" role="status" aria-live="polite">{blockError}</p> : null}
                              {blocksLoading ? <p className="text-sm text-muted" role="status" aria-live="polite">Loading maintenance windows…</p> : null}
                              {!blocksLoading && blocks.filter((block) => block.vehicle_id === vehicle.id).length === 0 ? (
                                <p className="text-sm text-muted">No maintenance windows scheduled.</p>
                              ) : (
                                <ul className="partner-doc-list">
                                  {blocks.filter((block) => block.vehicle_id === vehicle.id).map((block) => (
                                    <li className="partner-doc-item" key={block.id}>
                                      <div>
                                        <div className="partner-doc-type">{block.reason}</div>
                                        <div className="text-xs text-muted">{localDateTime(block.starts_at)} – {localDateTime(block.ends_at)}</div>
                                      </div>
                                      <button type="button" className="btn btn-secondary btn-sm" disabled={removingBlockId === block.id} onClick={() => removeBlock(block)}>
                                        {removingBlockId === block.id ? "Removing…" : "Remove"}
                                      </button>
                                    </li>
                                  ))}
                                </ul>
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
