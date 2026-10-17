"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import Sidebar from "@/app/components/Sidebar";
import { ADMIN_NAV_ITEMS } from "@/app/components/admin/admin-nav";
import Icon from "@/app/components/Icon";
import type { Vehicle, VehicleDocument } from "@/lib/types/domain";
import { vehicleDocumentDownloadPath, vehicleDocumentViewPath } from "@/lib/vehicles/documents";

type AdminVehicle = Vehicle & { owner_name: string };

type DocumentRow = {
  document: VehicleDocument;
  vehicle: AdminVehicle;
  owner_name: string;
};

type DocumentFilter = "all" | "expiring" | "expired";
type DocumentType = VehicleDocument["doc_type"];

const DOCUMENT_TYPES: Array<{ value: DocumentType; label: string }> = [
  { value: "rc", label: "Registration certificate" },
  { value: "insurance", label: "Insurance" },
  { value: "invoice", label: "Invoice" }
];

function daysUntilExpiry(value?: string | null) {
  if (!value) return null;
  const expiry = new Date(value);
  if (Number.isNaN(expiry.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  expiry.setHours(0, 0, 0, 0);
  return Math.ceil((expiry.getTime() - today.getTime()) / 86_400_000);
}

function formatDate(value?: string | null) {
  if (!value) return "No expiry date";
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(new Date(value));
}

function documentLabel(type: DocumentType) {
  return DOCUMENT_TYPES.find((item) => item.value === type)?.label ?? type;
}

function expiryLabel(document: VehicleDocument) {
  const days = daysUntilExpiry(document.expires_at);
  if (days === null) return { label: "No expiry set", tone: "neutral" };
  if (days < 0) return { label: `Expired ${formatDate(document.expires_at)}`, tone: "danger" };
  if (days <= 30) return { label: days === 0 ? "Expires today" : `Expires in ${days}d`, tone: "warning" };
  return { label: `Valid until ${formatDate(document.expires_at)}`, tone: "success" };
}

export default function AdminDocumentsPage() {
  const [vehicles, setVehicles] = useState<AdminVehicle[]>([]);
  const [rows, setRows] = useState<DocumentRow[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<DocumentFilter>("all");
  const [selectedVehicleId, setSelectedVehicleId] = useState("");
  const [documentType, setDocumentType] = useState<DocumentType>("rc");
  const [expiresAt, setExpiresAt] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [expiryDrafts, setExpiryDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadLibrary = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/documents", {
        credentials: "include",
        cache: "no-store"
      });
      const json = await response.json();
      if (!response.ok || !json.ok) {
        throw new Error(json?.error?.message ?? "Could not load vehicle documents.");
      }
      const nextVehicles = (json.data.vehicles ?? []) as AdminVehicle[];
      setVehicles(nextVehicles);
      setRows((json.data.documents ?? []) as DocumentRow[]);
      setSelectedVehicleId((current) => current || nextVehicles[0]?.id || "");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load vehicle documents.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadLibrary();
  }, [loadLibrary]);

  const selectedVehicle = vehicles.find((vehicle) => vehicle.id === selectedVehicleId) ?? null;
  const replacementRecord = rows.find(
    (row) => row.vehicle.id === selectedVehicleId && row.document.doc_type === documentType
  );

  const visibleRows = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return rows.filter(({ document, vehicle, owner_name }) => {
      const days = daysUntilExpiry(document.expires_at);
      if (filter === "expired" && !(days !== null && days < 0)) return false;
      if (filter === "expiring" && !(days !== null && days >= 0 && days <= 30)) return false;
      if (!query) return true;
      return [
        vehicle.brand,
        vehicle.model,
        vehicle.registration_number,
        vehicle.id,
        owner_name,
        documentLabel(document.doc_type)
      ].some((value) => value?.toLocaleLowerCase().includes(query));
    });
  }, [filter, rows, search]);

  const activeVehicleIds = useMemo(
    () => new Set(vehicles.filter((vehicle) => vehicle.is_active).map((vehicle) => vehicle.id)),
    [vehicles]
  );
  const activeDocuments = rows.filter((row) => activeVehicleIds.has(row.vehicle.id));
  const expiringCount = activeDocuments.filter((row) => {
    const days = daysUntilExpiry(row.document.expires_at);
    return days !== null && days >= 0 && days <= 30;
  }).length;
  const expiredCount = activeDocuments.filter((row) => {
    const days = daysUntilExpiry(row.document.expires_at);
    return days !== null && days < 0;
  }).length;
  const missingCount = Math.max(activeVehicleIds.size * DOCUMENT_TYPES.length - activeDocuments.length, 0);

  async function uploadDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedVehicleId || !file) {
      setError("Choose a vehicle and document file before uploading.");
      return;
    }
    setError(null);
    setSuccess(null);
    setBusyAction("upload");
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("doc_type", documentType);
      if (expiresAt) formData.append("expires_at", expiresAt);
      const response = await fetch(`/api/admin/vehicles/${selectedVehicleId}/documents`, {
        method: "POST",
        credentials: "include",
        body: formData
      });
      const json = await response.json();
      if (!response.ok || !json.ok) {
        throw new Error(json?.error?.message ?? "Document upload failed.");
      }
      setFile(null);
      setFileInputKey((current) => current + 1);
      setExpiresAt("");
      setSuccess(`${documentLabel(documentType)} ${replacementRecord ? "replaced" : "added"}.`);
      await loadLibrary();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Document upload failed.");
    } finally {
      setBusyAction(null);
    }
  }

  async function saveExpiry(row: DocumentRow) {
    const { document, vehicle } = row;
    setError(null);
    setSuccess(null);
    setBusyAction(`save-${document.id}`);
    try {
      const response = await fetch(`/api/admin/vehicles/${vehicle.id}/documents`, {
        method: "PATCH",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          doc_id: document.id,
          expires_at: expiryDrafts[document.id] || null
        })
      });
      const json = await response.json();
      if (!response.ok || !json.ok) {
        throw new Error(json?.error?.message ?? "Could not update the expiry date.");
      }
      setRows((current) => current.map((item) =>
        item.document.id === document.id ? { ...item, document: json.data.document } : item
      ));
      setSuccess(`${documentLabel(document.doc_type)} expiry updated.`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not update the expiry date.");
    } finally {
      setBusyAction(null);
    }
  }

  async function deleteDocument(row: DocumentRow) {
    const { document, vehicle } = row;
    if (!window.confirm(`Remove the ${documentLabel(document.doc_type)} for ${vehicle.brand} ${vehicle.model}?`)) return;
    setError(null);
    setSuccess(null);
    setBusyAction(`delete-${document.id}`);
    try {
      const response = await fetch(`/api/admin/vehicles/${vehicle.id}/documents`, {
        method: "DELETE",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ doc_id: document.id })
      });
      const json = await response.json();
      if (!response.ok || !json.ok) {
        throw new Error(json?.error?.message ?? "Could not remove this document.");
      }
      setRows((current) => current.filter((item) => item.document.id !== document.id));
      setExpiryDrafts((current) => {
        const next = { ...current };
        delete next[document.id];
        return next;
      });
      setSuccess(`${documentLabel(document.doc_type)} removed.`);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Could not remove this document.");
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <div className="dashboard-layout ops-shell">
      <Sidebar role="admin" navItems={ADMIN_NAV_ITEMS} userName="Admin (ops)" />
      <main className="dashboard-content admin-documents-page">
        <header className="admin-documents-header">
          <div>
            <p className="admin-documents-eyebrow">Fleet records</p>
            <h1>Vehicle documents</h1>
            <p>Find, update, and replace fleet paperwork from one place.</p>
          </div>
          <span className="admin-documents-header-icon" aria-hidden="true">
            <Icon name="document" />
          </span>
        </header>

        <section className="admin-document-stats" aria-label="Document overview">
          <article className="admin-document-stat">
            <span>Documents on file</span>
            <strong>{rows.length}</strong>
            <small>Across the registered fleet</small>
          </article>
          <article className="admin-document-stat admin-document-stat--warning">
            <span>Expiring soon</span>
            <strong>{expiringCount}</strong>
            <small>Due within 30 days</small>
          </article>
          <article className="admin-document-stat admin-document-stat--muted">
            <span>Expired / missing</span>
            <strong>{expiredCount} / {missingCount}</strong>
            <small>Active vehicles only</small>
          </article>
        </section>

        {(error || success) && (
          <div className={`admin-document-alert ${error ? "is-error" : "is-success"}`} role={error ? "alert" : "status"}>
            {error ?? success}
          </div>
        )}

        <section className="admin-document-workspace" aria-label="Manage fleet documents">
          <div className="admin-document-library">
            <div className="admin-document-library__heading">
              <div>
                <h2>Document library</h2>
                <p>{loading ? "Loading fleet records…" : `${visibleRows.length} of ${rows.length} documents`}</p>
              </div>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => void loadLibrary()} disabled={loading}>
                <Icon name="refresh" className="h-4 w-4" />
                Refresh
              </button>
            </div>

            <div className="admin-document-toolbar">
              <label className="admin-document-search">
                <Icon name="search" className="h-4 w-4" aria-hidden="true" />
                <span className="sr-only">Search vehicle documents</span>
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search vehicle, investor, or document"
                />
              </label>
              <div className="admin-document-filters" role="group" aria-label="Filter documents">
                {([
                  ["all", "All files"],
                  ["expiring", "Expiring soon"],
                  ["expired", "Expired"]
                ] as Array<[DocumentFilter, string]>).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className={filter === value ? "is-selected" : ""}
                    aria-pressed={filter === value}
                    onClick={() => setFilter(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {loading ? (
              <div className="admin-document-empty" role="status">Loading vehicle documents…</div>
            ) : visibleRows.length ? (
              <div className="admin-document-list">
                {visibleRows.map((row) => {
                  const { document, vehicle, owner_name } = row;
                  const expiry = expiryLabel(document);
                  const currentExpiry = expiryDrafts[document.id] ?? document.expires_at?.slice(0, 10) ?? "";
                  return (
                    <article className="admin-document-row" key={document.id}>
                      <div className="admin-document-row__identity">
                        <span className="admin-document-file-icon" aria-hidden="true"><Icon name="document" /></span>
                        <div>
                          <div className="admin-document-row__title">{documentLabel(document.doc_type)}</div>
                          <div className="admin-document-row__vehicle">
                            {vehicle.brand} {vehicle.model}
                            {vehicle.registration_number ? ` · ${vehicle.registration_number}` : ""}
                          </div>
                          <div className="admin-document-row__owner">{owner_name}</div>
                        </div>
                      </div>
                      <div className="admin-document-row__expiry">
                        <span className={`admin-document-expiry is-${expiry.tone}`}>{expiry.label}</span>
                        <label className="admin-document-expiry-edit">
                          <span className="sr-only">Edit expiry for {documentLabel(document.doc_type)} on {vehicle.brand} {vehicle.model}</span>
                          <input
                            type="date"
                            className="form-input"
                            value={currentExpiry}
                            onChange={(event) => setExpiryDrafts((current) => ({
                              ...current,
                              [document.id]: event.target.value
                            }))}
                          />
                        </label>
                      </div>
                      <div className="admin-document-row__actions">
                        <a className="btn btn-secondary btn-sm" href={vehicleDocumentViewPath(vehicle.id, document.id)} target="_blank" rel="noreferrer">View</a>
                        <a className="admin-document-download" href={vehicleDocumentDownloadPath(vehicle.id, document.id, true)}>Download</a>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => void saveExpiry(row)}
                          disabled={!!busyAction}
                        >
                          {busyAction === `save-${document.id}` ? "Saving…" : "Save date"}
                        </button>
                        <button
                          type="button"
                          className="admin-document-delete"
                          onClick={() => void deleteDocument(row)}
                          disabled={!!busyAction}
                        >
                          {busyAction === `delete-${document.id}` ? "Removing…" : "Remove"}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="admin-document-empty">
                <span className="admin-document-file-icon" aria-hidden="true"><Icon name="document" /></span>
                <h3>{rows.length ? "No documents match these filters" : "No vehicle documents yet"}</h3>
                <p>{rows.length ? "Try a different search or status filter." : "Upload an RC, insurance certificate, or invoice to start the fleet file."}</p>
              </div>
            )}
          </div>

          <aside className="admin-document-upload">
            <div className="admin-document-upload__heading">
              <span className="admin-document-upload__step">01</span>
              <div>
                <h2>Add a document</h2>
                <p>Choose the vehicle and file type.</p>
              </div>
            </div>
            <form onSubmit={uploadDocument}>
              <div className="form-group">
                <label className="form-label" htmlFor="document-vehicle">Vehicle</label>
                <select
                  id="document-vehicle"
                  className="form-input form-select"
                  value={selectedVehicleId}
                  onChange={(event) => setSelectedVehicleId(event.target.value)}
                  disabled={!vehicles.length}
                >
                  <option value="" disabled>Select a vehicle</option>
                  {vehicles.map((vehicle) => (
                    <option key={vehicle.id} value={vehicle.id}>
                      {vehicle.brand} {vehicle.model}{vehicle.registration_number ? ` · ${vehicle.registration_number}` : ""} · {vehicle.owner_name}{vehicle.is_active ? "" : " · inactive"}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="document-type">Document type</label>
                <select
                  id="document-type"
                  className="form-input form-select"
                  value={documentType}
                  onChange={(event) => setDocumentType(event.target.value as DocumentType)}
                >
                  {DOCUMENT_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="document-expiry">Expiry date <span>(optional)</span></label>
                <input
                  id="document-expiry"
                  type="date"
                  className="form-input"
                  value={expiresAt}
                  onChange={(event) => setExpiresAt(event.target.value)}
                />
              </div>
              <div className="admin-document-upload__file">
                <label className="form-label" htmlFor="document-file">File</label>
                <input
                  key={fileInputKey}
                  id="document-file"
                  type="file"
                  className="form-input"
                  accept="application/pdf,image/*"
                  onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                  required
                />
                <small>PDF or image · up to 15 MB</small>
              </div>
              {replacementRecord ? (
                <p className="admin-document-replace-note">
                  A {documentLabel(documentType).toLowerCase()} is already on file. Uploading replaces its current file.
                </p>
              ) : null}
              <button type="submit" className="btn btn-primary admin-document-upload__submit" disabled={!!busyAction || loading || !vehicles.length}>
                {busyAction === "upload" ? <span className="spinner" /> : <Icon name="checkCircle" className="h-4 w-4" />}
                {busyAction === "upload" ? "Uploading…" : replacementRecord ? "Replace document" : "Add document"}
              </button>
            </form>
            {selectedVehicle ? (
              <div className="admin-document-upload__vehicle">
                <span>Selected fleet owner</span>
                <strong>{selectedVehicle.owner_name}</strong>
                <small>{selectedVehicle.is_active ? "Active vehicle" : "Inactive vehicle"}</small>
              </div>
            ) : null}
          </aside>
        </section>
      </main>
    </div>
  );
}
