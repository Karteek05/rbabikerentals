"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import PartnerPageHeader from "@/app/components/partner/PartnerPageHeader";
import PartnerFilterDrawer from "@/app/components/partner/PartnerFilterDrawer";
import Icon from "@/app/components/Icon";import { formatBookingReference, getVehicleDisplayName } from "@/lib/fleet/display";
import { formatBookingStatus } from "@/lib/bookings/status-labels";
import {
  PARTNER_BOOKING_TABS,
  formatDateRangeLabel,
  getDefaultWeekStart,
  getWeekRangeFromStart
} from "@/app/components/partner/partner-nav";import type { PartnerBookingRow, PartnerBookingTab } from "@/lib/partner/service";

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

export default function PartnerBookingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const weekStart = searchParams.get("week") ?? getDefaultWeekStart();
  const status = (searchParams.get("status") as PartnerBookingTab) ?? "all";
  const [bookings, setBookings] = useState<PartnerBookingRow[]>([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const range = useMemo(() => getWeekRangeFromStart(weekStart), [weekStart]);

  const loadBookings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        status,
        from: range.from,
        to: range.to
      });
      const res = await fetch(`/api/partner/bookings?${params}`, { credentials: "include" });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json?.error?.message ?? "Failed to load bookings");
        return;
      }
      setBookings(json.data.items ?? []);
      setPage(1);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [range.from, range.to, status]);

  useEffect(() => {
    loadBookings();
  }, [loadBookings]);

  function updateParams(next: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) {
      if (!value) params.delete(key);
      else params.set(key, value);
    }
    router.replace(`/partner/bookings?${params.toString()}`);
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return bookings;
    return bookings.filter((booking) => booking.id.toLowerCase().includes(q));
  }, [bookings, search]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageItems = filtered.slice((page - 1) * pageSize, page * pageSize);

  return (
    <>
      <PartnerPageHeader
        title="Bookings"
        subtitle={`On This Week · ${formatDateRangeLabel(range.from, range.to)}`}
        onFilterClick={() => setFilterOpen(true)}
        actions={
          <div className="partner-search-wrap">
            <Icon name="search" className="w-4 h-4" />
            <input
              type="search"
              className="form-input partner-search-input"
              placeholder="Search by booking id"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        }
      />

      <div className="partner-tab-row mb-4">
        {PARTNER_BOOKING_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`partner-tab${status === tab.id ? " active" : ""}`}
            onClick={() => updateParams({ status: tab.id === "all" ? null : tab.id })}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error ? <div className="error-banner mb-4">{error}</div> : null}

      <div className="card partner-table-card">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Booking Id</th>
                <th>Customer</th>
                <th>Booking Date</th>
                <th>Pickup</th>
                <th>Drop</th>
                <th>Vehicle</th>
                <th>Status</th>
                <th>Payment</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.length === 0 ? (
                <tr>
                  <td colSpan={9} className="partner-empty-cell">
                    {loading ? "Loading…" : "No bookings found"}
                  </td>
                </tr>
              ) : (
                pageItems.map((booking) => (
                  <tr key={booking.id}>
                    <td className="td-id">{formatBookingReference(booking.id)}</td>
                    <td>
                      <div>{booking.customer_name}</div>
                      <div className="text-xs text-muted">{booking.customer_phone}</div>
                    </td>
                    <td>{formatDate(booking.created_at)}</td>
                    <td>{formatDate(booking.pickup_at)}</td>
                    <td>{formatDate(booking.drop_at)}</td>
                    <td>{getVehicleDisplayName(booking.vehicle_id)}</td>
                    <td>
                      <span className={`badge badge-${booking.status}`}>
                        {formatBookingStatus(booking.status)}
                      </span>
                    </td>
                    <td>
                      <span className={`badge badge-${booking.payment_status}`}>
                        {booking.payment_status}
                      </span>
                    </td>
                    <td>
                      <button type="button" className="partner-icon-btn" aria-label="View booking">
                        <Icon name="chevron-right" className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="partner-pagination">
          <span>
            {filtered.length} booking{filtered.length === 1 ? "" : "s"}
          </span>
          <div className="partner-pagination-controls">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={page <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              Previous
            </button>
            <span>
              Page {page} of {pageCount}
            </span>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={page >= pageCount}
              onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      <PartnerFilterDrawer
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        weekStart={weekStart}
        onApply={(nextWeek) => updateParams({ week: nextWeek })}
        onReset={() => updateParams({ week: getDefaultWeekStart() })}
      />
    </>
  );
}
