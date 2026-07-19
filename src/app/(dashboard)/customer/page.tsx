"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import CostBreakdown from "../../components/CostBreakdown";
import Sidebar from "../../components/Sidebar";
import Icon, { type IconName } from "../../components/Icon";
import { formatBookingStatus } from "@/lib/bookings/status-labels";

type Booking = {
  id: string;
  status: string;
  vehicle_id: string;
  pickup_at: string;
  drop_at: string;
  quote: {
    total_payable: number;
    base_amount?: number;
    duration_amount?: number;
    coupon_discount?: number;
    tax_amount?: number;
    deposit_amount?: number;
  };
};

import type { PricingQuote } from "@/lib/types/domain";

type VehicleOption = {
  id: string;
  name: string;
  category: string;
  icon: IconName;
  price_day: number;
  deposit: number;
  km: number;
  image_url?: string;
};

const VEHICLES: VehicleOption[] = [
  { id: "veh_001", name: "Honda Activa 6G", category: "SCOOTER", icon: "scooter", price_day: 399, deposit: 2000, km: 120, image_url: "/images/services/activa-6g.svg" },
  { id: "veh_002", name: "TVS NTorq 125", category: "SCOOTER", icon: "scooter", price_day: 449, deposit: 2500, km: 150, image_url: "/images/services/access-125.svg" },
  { id: "veh_003", name: "Royal Enfield Classic 350", category: "BIKE", icon: "bike", price_day: 799, deposit: 5000, km: 200 }
];

const navItems = [
  { href: "/customer", icon: "home", label: "Dashboard" },
  { href: "/customer#book", icon: "scooter", label: "Book a Bike" },
  { href: "/customer#bookings", icon: "list", label: "My Bookings" }
] as const;

function StatusBadge({ status }: { status: string }) {
  return <span className={`badge badge-${status.replace(/_/g, "_")}`}>{formatBookingStatus(status)}</span>;
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

export default function CustomerDashboardPage() {
  const [userId, setUserId] = useState("cust_001");
  const [quote, setQuote] = useState<PricingQuote | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState("all");
  const [selectedVehicle, setSelectedVehicle] = useState(VEHICLES[0]);
  const [durationBucket, setDurationBucket] = useState("day");
  const [durationValue, setDurationValue] = useState(1);
  const [extraHelmet, setExtraHelmet] = useState(0);
  const [coupon, setCoupon] = useState("WELCOME5");

  const [expandedBookingId, setExpandedBookingId] = useState<string | null>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);

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

  const loadBookings = useCallback(async () => {
    setError(null);
    const res = await fetch("/api/customer/bookings", { ...fetchInit });
    const json = await res.json();
    if (!res.ok || !json.ok) {
      setError(json?.error?.message ?? "Failed to fetch bookings");
      return;
    }
    setBookings(json.data.bookings);
  }, [fetchInit]);

  useEffect(() => {
    loadBookings().catch((e) => setError(String(e)));
  }, [loadBookings]);

  async function requestQuote() {
    setError(null);
    setLoading("quote");
    try {
      const res = await fetch("/api/quotes", {
        method: "POST",
        ...fetchInit,
        body: JSON.stringify({
          user_id: userId,
          vehicle_id: selectedVehicle.id,
          city: "bengaluru",
          duration_bucket: durationBucket,
          duration_value: durationValue,
          extra_helmet_count: extraHelmet,
          coupon_code: coupon || undefined
        })
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json?.error?.message ?? "Failed to generate quote");
      } else {
        setQuote(json.data);
        showSuccess("Quote generated successfully.");
      }
    } finally {
      setLoading(null);
    }
  }

  async function createBooking() {
    setError(null);
    setLoading("booking");
    const now = Date.now();
    const pickup = new Date(now + 60 * 60 * 1000).toISOString();
    const drop = new Date(now + (durationValue * 24 + 1) * 60 * 60 * 1000).toISOString();
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        ...fetchInit,
        body: JSON.stringify({
          user_id: userId,
          vehicle_id: selectedVehicle.id,
          city: "bengaluru",
          pickup_at: pickup,
          drop_at: drop,
          duration_bucket: durationBucket,
          duration_value: durationValue,
          km_limit_bucket: durationBucket,
          km_limit_value: selectedVehicle.km,
          extra_helmet_count: extraHelmet,
          coupon_code: coupon || undefined
        })
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json?.error?.message ?? "Failed to create booking");
      } else {
        showSuccess("Booking created successfully.");
        setQuote(null);
        await loadBookings();
      }
    } finally {
      setLoading(null);
    }
  }

  async function reportDamage(bookingId: string) {
    setError(null);
    setLoading(`damage-${bookingId}`);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/damage`, {
        method: "POST",
        ...fetchInit,
        body: JSON.stringify({
          description: "Minor scratch near front panel",
          photo_urls: ["https://example.com/damage/sample.jpg"]
        })
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json?.error?.message ?? "Failed to report damage");
      } else {
        showSuccess("Damage report submitted successfully.");
        await loadBookings();
      }
    } finally {
      setLoading(null);
    }
  }

  async function cancelBooking(bookingId: string) {
    setError(null);
    setLoading(`cancel-${bookingId}`);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/cancel`, {
        method: "POST",
        ...fetchInit,
        body: JSON.stringify({ reason: "Customer requested cancellation" })
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json?.error?.message ?? "Failed to cancel booking");
      } else {
        showSuccess("Booking cancelled.");
        await loadBookings();
      }
    } finally {
      setLoading(null);
    }
  }

  const filteredBookings = filterStatus === "all" ? bookings : bookings.filter((b) => b.status === filterStatus);

  const statusCounts = bookings.reduce<Record<string, number>>((acc, b) => {
    acc[b.status] = (acc[b.status] || 0) + 1;
    return acc;
  }, {});

  const filterTabs = [
    { key: "all", label: "All" },
    { key: "confirmed", label: "Confirmed" },
    { key: "ongoing", label: "Ongoing" },
    { key: "completed", label: "Completed" },
    { key: "cancelled", label: "Cancelled" }
  ];

  return (
    <div className="dashboard-layout">
      <Sidebar role="customer" navItems={[...navItems]} userName={userId === "cust_001" ? "Rahul Sharma" : "Priya Nair"} />

      <div className="dashboard-content">
        <div className="flex-between mb-6">
          <div className="page-header" style={{ marginBottom: 0 }}>
            <h1>
              Welcome back, <span style={{ color: "var(--primary)" }}>{userId === "cust_001" ? "Rahul" : "Priya"}</span>
            </h1>
            <p>Bengaluru booking, pricing, and ride management dashboard.</p>
          </div>

          <div className="form-group" style={{ width: 220, marginBottom: 0 }}>
            <label className="form-label">Switch User (Dev)</label>
            <select className="form-input form-select" value={userId} onChange={(e) => setUserId(e.target.value)}>
              <option value="cust_001">cust_001 - Rahul (verified)</option>
              <option value="cust_002">cust_002 - Priya (review pending)</option>
            </select>
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
            <div className="stat-label">Total Bookings</div>
            <div className="stat-value">{bookings.length}</div>
            <div className="stat-sub">All time</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Active</div>
            <div className="stat-value accent">{(statusCounts["ongoing"] || 0) + (statusCounts["confirmed"] || 0)}</div>
            <div className="stat-sub">Confirmed + Ongoing</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Completed</div>
            <div className="stat-value">{statusCounts["completed"] || 0}</div>
            <div className="stat-sub">All rides</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Pending review</div>
            <div className="stat-value accent">
              {(statusCounts["pending_kyc"] || 0) + (statusCounts["admin_review"] || 0)}
            </div>
            <div className="stat-sub">Awaiting team confirmation</div>
          </div>
        </div>

        <div id="book" className="card mb-6">
          <div className="section-header">
            <div>
              <h2 className="inline-flex items-center gap-2">
                <Icon name="scooter" className="w-5 h-5" />
                Book a Bike
              </h2>
              <p>Get a quote, then confirm your booking.</p>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={loadBookings} disabled={!!loading}>
              {loading === "refresh" ? <span className="spinner" /> : <Icon name="refresh" className="w-4 h-4" />} Refresh
            </button>
          </div>

          <div className="vehicle-grid mb-4">
            {VEHICLES.map((v) => (
              <div
                key={v.id}
                className="vehicle-card"
                onClick={() => {
                  setSelectedVehicle(v);
                  setQuote(null);
                }}
                style={{
                  border:
                    selectedVehicle.id === v.id
                      ? "2px solid var(--primary-container)"
                      : "1px solid rgba(90,65,54,0.1)",
                  boxShadow: selectedVehicle.id === v.id ? "var(--glow-primary)" : undefined
                }}
              >
                <div className="vehicle-card-image" style={{ width: "100%", height: 100, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                  {v.image_url ? (
                    <img src={v.image_url} alt={v.name} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                  ) : (
                    <Icon name={v.icon} className="w-8 h-8" />
                  )}
                </div>
                <div className="vehicle-card-body">
                  <div className="vehicle-card-name">{v.name}</div>
                  <div className="vehicle-card-category">{v.category}</div>
                  <div className="vehicle-specs">
                    <span className="spec-chip">{v.km} km/day</span>
                    <span className="spec-chip">Deposit ₹{v.deposit.toLocaleString()}</span>
                  </div>
                  <div className="vehicle-price">
                    <span className="price-amount">₹{v.price_day}</span>
                    <span className="price-unit">/ day</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="form-row mb-4">
            <div className="form-group">
              <label className="form-label">Duration Type</label>
              <select className="form-input form-select" value={durationBucket} onChange={(e) => setDurationBucket(e.target.value)}>
                <option value="hour">Hourly</option>
                <option value="day">Daily</option>
                <option value="week">Weekly</option>
                <option value="month">Monthly</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Duration Value</label>
              <input
                type="number"
                className="form-input"
                min={1}
                max={30}
                value={durationValue}
                onChange={(e) => setDurationValue(Number(e.target.value))}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Extra Helmets</label>
              <input
                type="number"
                className="form-input"
                min={0}
                max={2}
                value={extraHelmet}
                onChange={(e) => setExtraHelmet(Number(e.target.value))}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Coupon Code</label>
              <input
                type="text"
                className="form-input"
                value={coupon}
                placeholder="e.g. WELCOME5"
                onChange={(e) => setCoupon(e.target.value)}
              />
            </div>
          </div>

          <div className="flex gap-3">
            <button className="btn btn-secondary" onClick={requestQuote} disabled={!!loading}>
              {loading === "quote" ? <span className="spinner" /> : <Icon name="money" className="w-4 h-4" />} Get Quote
            </button>
            <button className="btn btn-primary" onClick={createBooking} disabled={!!loading}>
              {loading === "booking" ? <span className="spinner" /> : <Icon name="checkCircle" className="w-4 h-4" />} Confirm Booking
            </button>
          </div>

          {quote && (
            <div className="mt-4">
              <CostBreakdown quote={quote} showDeposit />
            </div>
          )}
        </div>

        <div id="bookings">
          <div className="section-header">
            <div>
              <h2 className="inline-flex items-center gap-2">
                <Icon name="list" className="w-5 h-5" />
                My Bookings
              </h2>
              <p>
                {bookings.length} booking{bookings.length !== 1 ? "s" : ""} total
              </p>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={loadBookings} disabled={!!loading}>
              <Icon name="refresh" className="w-4 h-4" /> Refresh
            </button>
          </div>

          <div className="filter-tabs">
            {filterTabs.map((tab) => (
              <button
                key={tab.key}
                className={`filter-tab${filterStatus === tab.key ? " active" : ""}`}
                onClick={() => setFilterStatus(tab.key)}
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
              <p>No bookings{filterStatus !== "all" ? ` with status "${filterStatus}"` : ""} yet.</p>
            </div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Booking ID</th>
                    <th>Vehicle</th>
                    <th>Pickup</th>
                    <th>Drop</th>
                    <th>Status</th>
                    <th>Payable</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBookings.map((booking) => (
                    <Fragment key={booking.id}>
                      <tr>
                      <td className="td-id">{booking.id}</td>
                      <td className="td-muted">{booking.vehicle_id}</td>
                      <td className="td-muted">{formatDate(booking.pickup_at)}</td>
                      <td className="td-muted">{formatDate(booking.drop_at)}</td>
                      <td>
                        <StatusBadge status={booking.status} />
                      </td>
                      <td style={{ fontWeight: 700, color: "var(--primary)" }}>₹{(booking.quote?.total_payable ?? 0).toLocaleString()}</td>
                      <td>
                        <div className="flex gap-2">
                          {["ongoing", "confirmed"].includes(booking.status) && (
                            <button
                              className="btn btn-danger btn-sm"
                              onClick={() => reportDamage(booking.id)}
                              disabled={loading === `damage-${booking.id}`}
                            >
                              {loading === `damage-${booking.id}` ? <span className="spinner" /> : <Icon name="warning" className="w-4 h-4" />} Damage
                            </button>
                          )}
                          {["confirmed", "payment_pending", "draft"].includes(booking.status) && (
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => cancelBooking(booking.id)}
                              disabled={loading === `cancel-${booking.id}`}
                            >
                              {loading === `cancel-${booking.id}` ? <span className="spinner" /> : <Icon name="close" className="w-4 h-4" />} Cancel
                            </button>
                          )}
                          {["confirmed", "ongoing", "extended", "completed"].includes(booking.status) && (
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => {
                                if (expandedBookingId === booking.id) {
                                  setExpandedBookingId(null);
                                } else {
                                  setExpandedBookingId(booking.id);
                                  setLoadingDocs(true);
                                  fetch(`/api/vehicles/${booking.vehicle_id}/documents`, { credentials: "include" })
                                    .then(res => res.json())
                                    .then(json => {
                                      if (json.ok) setDocuments(json.data.documents || []);
                                      setLoadingDocs(false);
                                    })
                                    .catch(() => setLoadingDocs(false));
                                }
                              }}
                            >
                              Docs
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {expandedBookingId === booking.id && (
                      <tr style={{ background: "rgba(0,0,0,0.02)" }}>
                        <td colSpan={7}>
                          <div style={{ padding: "1rem" }}>
                            <div style={{ fontWeight: 600, marginBottom: "0.5rem" }}>Vehicle Documents</div>
                            {loadingDocs ? (
                              <div className="text-sm text-muted">Loading documents...</div>
                            ) : documents.length === 0 ? (
                              <div className="text-sm text-muted">No documents available for this vehicle.</div>
                            ) : (
                              <div className="flex gap-4 flex-wrap">
                                {documents.map((doc: any) => (
                                  <div key={doc.id} className="card p-3" style={{ minWidth: 200 }}>
                                    <div style={{ fontWeight: 600, fontSize: "0.85rem", marginBottom: 4 }}>{doc.doc_type.toUpperCase()}</div>
                                    <div className="text-xs text-muted mb-2">Expires: {doc.expires_at ? new Date(doc.expires_at).toLocaleDateString() : "N/A"}</div>
                                    <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="btn btn-primary btn-sm w-full" style={{ textAlign: "center" }}>
                                      View Document
                                    </a>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
