"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Sidebar from "../../components/Sidebar";
import Icon from "../../components/Icon";
import VehicleTrackingMap, { type TrackingVehicleItem } from "../../components/VehicleTrackingMap";

type Booking = {
  id: string;
  status: string;
  user_id: string;
  vehicle_id: string;
  cancel_reason?: string;
  pickup_at?: string;
  drop_at?: string;
  pickup_zone?: string | null;
  quote?: { total_payable?: number };
  created_at?: string;
  user?: {
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    pan_number?: string | null;
    date_of_birth?: string | null;
  } | null;
  kyc?: {
    status?: string;
    aadhaar_verified?: boolean;
    dl_verified?: boolean;
    cibil_score?: number | null;
    cibil_risk_band?: string | null;
  } | null;
};

type KycItem = {
  user_id: string;
  status: string;
  updated_at: string;
  aadhaar_verified?: boolean;
  dl_verified?: boolean;
  cibil_score?: number;
  cibil_risk_band?: string | null;
  failure_reason?: string;
};

type VehicleItem = {
  id: string;
  owner_id: string;
  city: "bengaluru";
  category: "scooter" | "bike" | "ev_bike";
  brand: string;
  model: string;
  image_urls?: string[];
  is_active: boolean;
  deposit_amount: number;
  rate_per_hour: number;
  rate_per_day: number;
  rate_per_week: number;
  rate_per_month: number;
};

type VehicleForm = {
  owner_id: string;
  category: "scooter" | "bike" | "ev_bike";
  brand: string;
  model: string;
  is_active: boolean;
  deposit_amount: number;
  rate_per_hour: number;
  rate_per_day: number;
  rate_per_week: number;
  rate_per_month: number;
};

const navItems = [
  { href: "/admin", icon: "settings", label: "Dashboard" },
  { href: "/admin#fleet", icon: "bike", label: "Fleet Ops" },
  { href: "/admin#bookings", icon: "list", label: "Bookings" },
  { href: "/admin#tracking", icon: "location", label: "Live Tracking" },
  { href: "/admin#audit", icon: "search", label: "Audit Logs" }
] as const;

const emptyVehicleForm: VehicleForm = {
  owner_id: "partner_001",
  category: "scooter",
  brand: "Honda",
  model: "Activa 110",
  is_active: true,
  deposit_amount: 2000,
  rate_per_hour: 0,
  rate_per_day: 3200,
  rate_per_week: 1600,
  rate_per_month: 6000
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`badge badge-${status.replace(/_/g, "_")}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

function formatDate(iso?: string) {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short"
    });
  } catch {
    return iso;
  }
}

function mapVehicleToForm(vehicle: VehicleItem): VehicleForm {
  return {
    owner_id: vehicle.owner_id,
    category: vehicle.category,
    brand: vehicle.brand,
    model: vehicle.model,
    is_active: vehicle.is_active,
    deposit_amount: vehicle.deposit_amount,
    rate_per_hour: vehicle.rate_per_hour,
    rate_per_day: vehicle.rate_per_day,
    rate_per_week: vehicle.rate_per_week,
    rate_per_month: vehicle.rate_per_month
  };
}

export default function AdminDashboardPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [kycItems, setKycItems] = useState<KycItem[]>([]);
  const [vehicles, setVehicles] = useState<VehicleItem[]>([]);
  const [trackingItems, setTrackingItems] = useState<TrackingVehicleItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [bookingFilter, setBookingFilter] = useState("all");
  const [editingVehicleId, setEditingVehicleId] = useState<string | null>(null);
  const [vehicleForm, setVehicleForm] = useState<VehicleForm>(emptyVehicleForm);
  const [newImageUrl, setNewImageUrl] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  const headers = useMemo(
    () => ({
      "content-type": "application/json",
      "x-user-id": "admin_001",
      "x-role": "admin"
    }),
    []
  );

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  const selectedVehicle = useMemo(
    () => vehicles.find((vehicle) => vehicle.id === editingVehicleId) ?? null,
    [vehicles, editingVehicleId]
  );

  const refreshAll = useCallback(async () => {
    setError(null);
    setLoading("refresh");
    try {
      const [bookingsRes, trackingRes, vehiclesRes] = await Promise.all([
        fetch("/api/admin/bookings", { headers }),
        fetch("/api/admin/tracking", { headers }),
        fetch("/api/admin/vehicles?include_inactive=true", { headers })
      ]);
      const [bookingsJson, trackingJson, vehiclesJson] = await Promise.all([
        bookingsRes.json(),
        trackingRes.json(),
        vehiclesRes.json()
      ]);

      if (!bookingsRes.ok || !bookingsJson.ok) {
        setError(bookingsJson?.error?.message ?? "Failed to load bookings");
        return;
      }
      if (!trackingRes.ok || !trackingJson.ok) {
        setError(trackingJson?.error?.message ?? "Failed to load tracking data");
        return;
      }
      if (!vehiclesRes.ok || !vehiclesJson.ok) {
        setError(vehiclesJson?.error?.message ?? "Failed to load vehicles");
        return;
      }

      const nextVehicles = (vehiclesJson.data.vehicles as VehicleItem[]) ?? [];
      setBookings(bookingsJson.data.bookings);
      setKycItems([]);
      setTrackingItems(trackingJson.data.items ?? []);
      setVehicles(nextVehicles);

      if (editingVehicleId && !nextVehicles.some((vehicle) => vehicle.id === editingVehicleId)) {
        setEditingVehicleId(null);
        setVehicleForm(emptyVehicleForm);
      }
    } finally {
      setLoading(null);
    }
  }, [headers, editingVehicleId]);

  useEffect(() => {
    refreshAll().catch((e) => setError(String(e)));
  }, [refreshAll]);

  async function rejectBooking(bookingId: string) {
    setError(null);
    setLoading(`reject-${bookingId}`);
    try {
      const res = await fetch(`/api/admin/bookings/${bookingId}/reject`, {
        method: "POST",
        headers,
        body: JSON.stringify({ reason: "Admin rejected during ops review" })
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json?.error?.message ?? "Failed to reject booking");
      } else {
        showSuccess(`Booking ${bookingId} rejected.`);
        await refreshAll();
      }
    } finally {
      setLoading(null);
    }
  }

  async function approveBooking(bookingId: string) {
    setError(null);
    setLoading(`approve-${bookingId}`);
    try {
      const res = await fetch(`/api/admin/bookings/${bookingId}/approve`, {
        method: "POST",
        headers,
        body: JSON.stringify({ note: "Approved for payment after ops review" })
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json?.error?.message ?? "Failed to approve booking");
      } else {
        showSuccess(`Booking ${bookingId} approved for payment.`);
        await refreshAll();
      }
    } finally {
      setLoading(null);
    }
  }

  async function approveKyc(userId: string) {
    setError(null);
    setLoading(`approve-kyc-${userId}`);
    try {
      const res = await fetch(`/api/admin/kyc/${userId}/approve`, {
        method: "POST",
        headers
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json?.error?.message ?? "Failed to approve KYC");
      } else {
        showSuccess(`KYC for ${userId} approved.`);
        await refreshAll();
      }
    } finally {
      setLoading(null);
    }
  }

  async function rejectKyc(userId: string) {
    setError(null);
    setLoading(`reject-kyc-${userId}`);
    try {
      const res = await fetch(`/api/admin/kyc/${userId}/reject`, {
        method: "POST",
        headers,
        body: JSON.stringify({ reason: "Document mismatch" })
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json?.error?.message ?? "Failed to reject KYC");
      } else {
        showSuccess(`KYC for ${userId} rejected.`);
        await refreshAll();
      }
    } finally {
      setLoading(null);
    }
  }

  async function saveVehicle() {
    setError(null);
    setLoading("save-vehicle");
    try {
      const payload = {
        ...vehicleForm,
        city: "bengaluru"
      };
      const url = editingVehicleId
        ? `/api/admin/vehicles/${editingVehicleId}`
        : "/api/admin/vehicles";
      const method = editingVehicleId ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers,
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json?.error?.message ?? "Failed to save vehicle");
        return;
      }
      const vehicleId = json?.data?.vehicle?.id as string | undefined;
      if (!editingVehicleId && vehicleId) {
        setEditingVehicleId(vehicleId);
      }
      showSuccess(editingVehicleId ? "Vehicle updated successfully." : "Vehicle created successfully.");
      await refreshAll();
    } finally {
      setLoading(null);
    }
  }

  function editVehicle(vehicle: VehicleItem) {
    setEditingVehicleId(vehicle.id);
    setVehicleForm(mapVehicleToForm(vehicle));
    setNewImageUrl("");
    setUploadFile(null);
    setError(null);
  }

  function resetVehicleEditor() {
    setEditingVehicleId(null);
    setVehicleForm(emptyVehicleForm);
    setNewImageUrl("");
    setUploadFile(null);
  }

  async function toggleVehicle(vehicle: VehicleItem) {
    setError(null);
    setLoading(`toggle-${vehicle.id}`);
    try {
      const res = await fetch(`/api/admin/vehicles/${vehicle.id}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ is_active: !vehicle.is_active })
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json?.error?.message ?? "Failed to update vehicle status");
      } else {
        showSuccess(
          `Vehicle ${vehicle.id} ${vehicle.is_active ? "deactivated" : "activated"} successfully.`
        );
        await refreshAll();
      }
    } finally {
      setLoading(null);
    }
  }

  async function deleteVehicle(vehicleId: string) {
    if (!window.confirm(`Delete vehicle ${vehicleId}? This cannot be undone.`)) return;
    setError(null);
    setLoading(`delete-${vehicleId}`);
    try {
      const res = await fetch(`/api/admin/vehicles/${vehicleId}`, {
        method: "DELETE",
        headers
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json?.error?.message ?? "Failed to delete vehicle");
      } else {
        showSuccess(`Vehicle ${vehicleId} deleted.`);
        if (editingVehicleId === vehicleId) resetVehicleEditor();
        await refreshAll();
      }
    } finally {
      setLoading(null);
    }
  }

  async function addImageUrl() {
    if (!editingVehicleId) {
      setError("Create or select a vehicle first before adding images.");
      return;
    }
    if (!newImageUrl.trim()) {
      setError("Enter an image URL.");
      return;
    }
    setError(null);
    setLoading("image-url");
    try {
      const res = await fetch(`/api/admin/vehicles/${editingVehicleId}/images`, {
        method: "POST",
        headers,
        body: JSON.stringify({ image_url: newImageUrl.trim() })
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json?.error?.message ?? "Failed to add image URL");
      } else {
        setNewImageUrl("");
        showSuccess("Image URL added.");
        await refreshAll();
      }
    } finally {
      setLoading(null);
    }
  }

  async function uploadVehicleImage() {
    if (!editingVehicleId) {
      setError("Create or select a vehicle first before uploading images.");
      return;
    }
    if (!uploadFile) {
      setError("Choose an image file first.");
      return;
    }
    setError(null);
    setLoading("image-file");
    try {
      const formData = new FormData();
      formData.append("file", uploadFile);
      const res = await fetch(`/api/admin/vehicles/${editingVehicleId}/images`, {
        method: "POST",
        headers: {
          "x-user-id": "admin_001",
          "x-role": "admin"
        },
        body: formData
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json?.error?.message ?? "Failed to upload image");
      } else {
        setUploadFile(null);
        showSuccess("Vehicle image uploaded.");
        await refreshAll();
      }
    } finally {
      setLoading(null);
    }
  }

  async function removeImage(imageUrl: string) {
    if (!selectedVehicle) return;
    setError(null);
    setLoading("remove-image");
    try {
      const nextImages = (selectedVehicle.image_urls ?? []).filter((item) => item !== imageUrl);
      const res = await fetch(`/api/admin/vehicles/${selectedVehicle.id}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ image_urls: nextImages })
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json?.error?.message ?? "Failed to remove image");
      } else {
        showSuccess("Image removed.");
        await refreshAll();
      }
    } finally {
      setLoading(null);
    }
  }

  const statusCounts = bookings.reduce<Record<string, number>>((acc, booking) => {
    acc[booking.status] = (acc[booking.status] || 0) + 1;
    return acc;
  }, {});

  const filteredBookings =
    bookingFilter === "all" ? bookings : bookings.filter((booking) => booking.status === bookingFilter);
  const approvableStatuses = new Set(["pending_kyc", "admin_review"]);

  const totalRevenue = bookings
    .filter((booking) =>
      ["confirmed", "ongoing", "completed", "extended"].includes(booking.status)
    )
    .reduce((sum, booking) => sum + (booking.quote?.total_payable ?? 0), 0);

  const activeFleetCount = vehicles.filter((vehicle) => vehicle.is_active).length;
  const inactiveFleetCount = vehicles.length - activeFleetCount;

  const filterTabs = [
    { key: "all", label: "All" },
    { key: "pending_kyc", label: "Pending" },
    { key: "admin_review", label: "Admin Review" },
    { key: "payment_pending", label: "Payment Pending" },
    { key: "confirmed", label: "Confirmed" },
    { key: "ongoing", label: "Ongoing" },
    { key: "cancelled", label: "Cancelled" }
  ];

  const sortedVehicles = [...vehicles].sort((a, b) => a.id.localeCompare(b.id));

  return (
    <div className="dashboard-layout">
      <Sidebar role="admin" navItems={[...navItems]} userName="Admin (ops)" />

      <div className="dashboard-content">
        <div className="flex-between mb-6">
          <div className="page-header" style={{ marginBottom: 0 }}>
            <h1 className="inline-flex items-center gap-2">
              <Icon name="settings" className="w-5 h-5" />
              Admin Dashboard
            </h1>
            <p>Booking operations, fleet controls, approval review, and platform tracking.</p>
          </div>
          <button className="btn btn-secondary" onClick={refreshAll} disabled={!!loading}>
            {loading === "refresh" ? <span className="spinner" /> : <Icon name="refresh" className="w-4 h-4" />} Refresh All
          </button>
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
            <div className="stat-label">Total Bookings</div>
            <div className="stat-value">{bookings.length}</div>
            <div className="stat-sub">All statuses</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Admin Review Queue</div>
            <div className="stat-value accent">{statusCounts["admin_review"] || 0}</div>
            <div className="stat-sub">Awaiting approval</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Active Fleet</div>
            <div className="stat-value">{activeFleetCount}</div>
            <div className="stat-sub">Inactive: {inactiveFleetCount}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Active Rides</div>
            <div className="stat-value">{statusCounts["ongoing"] || 0}</div>
            <div className="stat-sub">Currently ongoing</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Platform Revenue</div>
            <div className="stat-value accent" style={{ fontSize: "1.4rem" }}>
              ₹{totalRevenue.toLocaleString()}
            </div>
            <div className="stat-sub">Confirmed + active</div>
          </div>
        </div>

        <div id="fleet" className="mb-6">
          <div className="section-header mb-4">
            <div>
              <h2 className="inline-flex items-center gap-2">
                <Icon name="bike" className="w-5 h-5" />
                Fleet Operations
              </h2>
              <p>Create, update, deactivate, delete vehicles, and manage images.</p>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="card p-4 lg:col-span-1">
              <div className="flex-between mb-4">
                <div style={{ fontWeight: 700 }}>
                  {editingVehicleId ? `Editing ${editingVehicleId}` : "Add New Vehicle"}
                </div>
                {editingVehicleId && (
                  <button className="btn btn-secondary btn-sm" onClick={resetVehicleEditor}>
                    Cancel Edit
                  </button>
                )}
              </div>

              <div className="form-row mb-3" style={{ gridTemplateColumns: "1fr 1fr" }}>
                <div className="form-group">
                  <label className="form-label">Owner ID</label>
                  <input
                    className="form-input"
                    value={vehicleForm.owner_id}
                    onChange={(event) =>
                      setVehicleForm((prev) => ({ ...prev, owner_id: event.target.value }))
                    }
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Category</label>
                  <select
                    className="form-input form-select"
                    value={vehicleForm.category}
                    onChange={(event) =>
                      setVehicleForm((prev) => ({
                        ...prev,
                        category: event.target.value as VehicleForm["category"]
                      }))
                    }
                  >
                    <option value="scooter">Scooter</option>
                    <option value="bike">Bike</option>
                    <option value="ev_bike">EV Bike</option>
                  </select>
                </div>
              </div>

              <div className="form-row mb-3" style={{ gridTemplateColumns: "1fr 1fr" }}>
                <div className="form-group">
                  <label className="form-label">Brand</label>
                  <input
                    className="form-input"
                    value={vehicleForm.brand}
                    onChange={(event) =>
                      setVehicleForm((prev) => ({ ...prev, brand: event.target.value }))
                    }
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Model</label>
                  <input
                    className="form-input"
                    value={vehicleForm.model}
                    onChange={(event) =>
                      setVehicleForm((prev) => ({ ...prev, model: event.target.value }))
                    }
                  />
                </div>
              </div>

              <div className="form-row mb-3" style={{ gridTemplateColumns: "1fr 1fr" }}>
                <div className="form-group">
                  <label className="form-label">Deposit (₹)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={vehicleForm.deposit_amount}
                    onChange={(event) =>
                      setVehicleForm((prev) => ({
                        ...prev,
                        deposit_amount: Number(event.target.value)
                      }))
                    }
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Hourly Rate (₹)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={vehicleForm.rate_per_hour}
                    onChange={(event) =>
                      setVehicleForm((prev) => ({
                        ...prev,
                        rate_per_hour: Number(event.target.value)
                      }))
                    }
                  />
                </div>
              </div>

              <div className="form-row mb-3" style={{ gridTemplateColumns: "1fr 1fr" }}>
                <div className="form-group">
                  <label className="form-label">Daily Rate (₹)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={vehicleForm.rate_per_day}
                    onChange={(event) =>
                      setVehicleForm((prev) => ({
                        ...prev,
                        rate_per_day: Number(event.target.value)
                      }))
                    }
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Weekly Rate (₹)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={vehicleForm.rate_per_week}
                    onChange={(event) =>
                      setVehicleForm((prev) => ({
                        ...prev,
                        rate_per_week: Number(event.target.value)
                      }))
                    }
                  />
                </div>
              </div>

              <div className="form-row mb-4" style={{ gridTemplateColumns: "1fr 1fr" }}>
                <div className="form-group">
                  <label className="form-label">Monthly Rate (₹)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={vehicleForm.rate_per_month}
                    onChange={(event) =>
                      setVehicleForm((prev) => ({
                        ...prev,
                        rate_per_month: Number(event.target.value)
                      }))
                    }
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select
                    className="form-input form-select"
                    value={vehicleForm.is_active ? "active" : "inactive"}
                    onChange={(event) =>
                      setVehicleForm((prev) => ({
                        ...prev,
                        is_active: event.target.value === "active"
                      }))
                    }
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <button className="btn btn-primary w-full" onClick={saveVehicle} disabled={!!loading}>
                {loading === "save-vehicle" ? <span className="spinner" /> : <Icon name="checkCircle" className="w-4 h-4" />}
                {editingVehicleId ? "Update Vehicle" : "Create Vehicle"}
              </button>

              {selectedVehicle && (
                <div style={{ marginTop: 18, borderTop: "1px solid rgba(0,0,0,0.08)", paddingTop: 14 }}>
                  <div style={{ fontWeight: 700, marginBottom: 10 }}>Vehicle Images</div>
                  <div className="form-group mb-2">
                    <label className="form-label">Add Image URL</label>
                    <div className="flex gap-2">
                      <input
                        className="form-input"
                        value={newImageUrl}
                        onChange={(event) => setNewImageUrl(event.target.value)}
                        placeholder="https://..."
                      />
                      <button className="btn btn-secondary btn-sm" onClick={addImageUrl} disabled={!!loading}>
                        {loading === "image-url" ? <span className="spinner" /> : "Add"}
                      </button>
                    </div>
                  </div>

                  <div className="form-group mb-3">
                    <label className="form-label">Upload Image File</label>
                    <div className="flex gap-2">
                      <input
                        type="file"
                        className="form-input"
                        accept="image/*"
                        onChange={(event) => setUploadFile(event.target.files?.[0] ?? null)}
                      />
                      <button className="btn btn-secondary btn-sm" onClick={uploadVehicleImage} disabled={!!loading}>
                        {loading === "image-file" ? <span className="spinner" /> : "Upload"}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {(selectedVehicle.image_urls ?? []).map((imageUrl) => (
                      <div key={imageUrl} className="card p-2">
                        <img
                          src={imageUrl}
                          alt="vehicle"
                          style={{
                            width: "100%",
                            height: 74,
                            objectFit: "cover",
                            borderRadius: 8,
                            border: "1px solid rgba(0,0,0,0.08)"
                          }}
                        />
                        <button
                          className="btn btn-danger btn-sm w-full mt-2"
                          onClick={() => removeImage(imageUrl)}
                          disabled={!!loading}
                        >
                          {loading === "remove-image" ? <span className="spinner" /> : "Remove"}
                        </button>
                      </div>
                    ))}
                    {(selectedVehicle.image_urls ?? []).length === 0 && (
                      <div className="text-xs text-muted">No images added yet.</div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="card p-4 lg:col-span-2">
              <div className="section-header mb-4">
                <div>
                  <h2 className="inline-flex items-center gap-2">
                    <Icon name="list" className="w-5 h-5" />
                    Vehicle List
                  </h2>
                  <p>{sortedVehicles.length} vehicles in admin fleet catalog</p>
                </div>
              </div>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Vehicle</th>
                      <th>Owner</th>
                      <th>Rates</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedVehicles.map((vehicle) => (
                      <tr key={vehicle.id}>
                        <td className="td-id">{vehicle.id}</td>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <img
                              src={vehicle.image_urls?.[0] || "/images/services/activa-6g.svg"}
                              alt={`${vehicle.brand} ${vehicle.model}`}
                              style={{
                                width: 50,
                                height: 36,
                                objectFit: "cover",
                                borderRadius: 8,
                                border: "1px solid rgba(0,0,0,0.08)"
                              }}
                            />
                            <div>
                              <div style={{ fontWeight: 700 }}>
                                {vehicle.brand} {vehicle.model}
                              </div>
                              <div className="text-xs text-muted">{vehicle.category}</div>
                            </div>
                          </div>
                        </td>
                        <td className="td-muted">{vehicle.owner_id}</td>
                        <td className="text-xs text-muted">
                          Hr ₹{vehicle.rate_per_hour} · Day ₹{vehicle.rate_per_day} · Wk ₹
                          {vehicle.rate_per_week} · Mo ₹{vehicle.rate_per_month}
                        </td>
                        <td>
                          <StatusBadge status={vehicle.is_active ? "active" : "cancelled"} />
                        </td>
                        <td>
                          <div className="flex gap-2">
                            <button className="btn btn-secondary btn-sm" onClick={() => editVehicle(vehicle)}>
                              Edit
                            </button>
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => toggleVehicle(vehicle)}
                              disabled={!!loading}
                            >
                              {loading === `toggle-${vehicle.id}` ? <span className="spinner" /> : vehicle.is_active ? "Deactivate" : "Activate"}
                            </button>
                            <button
                              className="btn btn-danger btn-sm"
                              onClick={() => deleteVehicle(vehicle.id)}
                              disabled={!!loading}
                            >
                              {loading === `delete-${vehicle.id}` ? <span className="spinner" /> : "Delete"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <div id="bookings" className="mb-6">
          <div className="section-header mb-4">
            <div>
              <h2 className="inline-flex items-center gap-2">
                <Icon name="list" className="w-5 h-5" />
                All Bookings
              </h2>
              <p>
                {filteredBookings.length} booking
                {filteredBookings.length !== 1 ? "s" : ""} shown
              </p>
            </div>
          </div>

          <div className="filter-tabs">
            {filterTabs.map((tab) => (
              <button
                key={tab.key}
                className={`filter-tab${bookingFilter === tab.key ? " active" : ""}`}
                onClick={() => setBookingFilter(tab.key)}
              >
                {tab.label}
                {tab.key !== "all" && statusCounts[tab.key] ? (
                  <span
                    style={{
                      marginLeft: 4,
                      background: "var(--surface-highest)",
                      borderRadius: "100px",
                      padding: "0 5px",
                      fontSize: "0.65rem"
                    }}
                  >
                    {statusCounts[tab.key]}
                  </span>
                ) : null}
              </button>
            ))}
          </div>

          {filteredBookings.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon inline-flex items-center justify-center">
                <Icon name="list" className="w-6 h-6" />
              </div>
              <p>No bookings found.</p>
            </div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Booking ID</th>
                    <th>Customer</th>
                    <th>Vehicle</th>
                    <th>Pickup</th>
                    <th>Drop</th>
                    <th>Status</th>
                    <th>Review</th>
                    <th>Amount</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBookings.map((booking) => (
                    <tr key={booking.id}>
                      <td className="td-id">{booking.id}</td>
                      <td className="td-muted">
                        <div style={{ fontWeight: 700, color: "var(--on-surface)" }}>
                          {booking.user?.name ?? booking.user_id}
                        </div>
                        <div className="text-xs text-muted">{booking.user?.email ?? booking.user_id}</div>
                        {booking.user?.phone && <div className="text-xs text-muted">{booking.user.phone}</div>}
                      </td>
                      <td className="td-muted">{booking.vehicle_id}</td>
                      <td className="td-muted">
                        <div>{formatDate(booking.pickup_at)}</div>
                        <div className="text-xs text-muted">{booking.pickup_zone ?? "Bengaluru"}</div>
                      </td>
                      <td className="td-muted">{formatDate(booking.drop_at)}</td>
                      <td>
                        <StatusBadge status={booking.status} />
                      </td>
                      <td>
                        <div className="flex gap-2" style={{ flexWrap: "wrap" }}>
                          <span className="spec-chip">
                            {approvableStatuses.has(booking.status)
                              ? "Awaiting admin approval"
                              : booking.status === "payment_pending"
                                ? "Payment link sent"
                                : booking.status.replace(/_/g, " ")}
                          </span>
                        </div>
                      </td>
                      <td style={{ fontWeight: 700, color: "var(--primary)" }}>
                        {booking.quote?.total_payable
                          ? `₹${booking.quote.total_payable.toLocaleString()}`
                          : "-"}
                      </td>
                      <td>
                        <div className="flex gap-2" style={{ flexWrap: "wrap" }}>
                          {booking.status === "pending_kyc" && (
                            <button
                              className="btn btn-success btn-sm"
                              onClick={() => approveBooking(booking.id)}
                              disabled={loading === `approve-${booking.id}`}
                            >
                              {loading === `approve-${booking.id}` ? (
                                <span className="spinner" />
                              ) : (
                                <Icon name="checkCircle" className="w-4 h-4" />
                              )}{" "}
                              Approve
                            </button>
                          )}
                        {!["cancelled", "completed"].includes(booking.status) && (
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => rejectBooking(booking.id)}
                            disabled={loading === `reject-${booking.id}`}
                          >
                            {loading === `reject-${booking.id}` ? (
                              <span className="spinner" />
                            ) : (
                              <Icon name="close" className="w-4 h-4" />
                            )}{" "}
                            Reject
                          </button>
                        )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div id="tracking" className="mb-6">
          <VehicleTrackingMap
            title="Platform Live Tracking"
            subtitle="Real-time location snapshots for all active tracked vehicles."
            items={trackingItems}
          />
        </div>
      </div>
    </div>
  );
}
