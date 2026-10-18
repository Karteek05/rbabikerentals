"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import PartnerPageHeader from "../../components/partner/PartnerPageHeader";
import PartnerFilterDrawer from "../../components/partner/PartnerFilterDrawer";
import PartnerKpiCard from "../../components/partner/PartnerKpiCard";
import StatusDonut from "../../components/partner/StatusDonut";
import BookingsWeekChart from "../../components/partner/BookingsWeekChart";
import {
  PARTNER_BOOKING_TABS,
  formatDateRangeLabel,
  getDefaultWeekStart,
  getWeekRangeFromStart
} from "../../components/partner/partner-nav";
import type { PartnerBookingTab } from "@/lib/partner/service";
import { PartnerDashboardSkeleton } from "@/components/ui/Skeleton";

type DashboardSummary = {
  total_vehicles: number;
  total_bookings: number;
  total_revenue: number;
  active_rides: number;
  status_breakdown: { idle: number; halt: number; running: number; waiting: number };
  bookings_by_weekday: Array<{ day: string; count: number }>;
};

type RevenueAnalytics = {
  totals: {
    booking_count: number;
    gross_revenue: number;
    pending_revenue: number;
    completed_revenue: number;
  };
  vehicle_wise: Array<{
    vehicle_id: string;
    vehicle_label: string;
    registration_number: string | null;
    booking_count: number;
    revenue: number;
  }>;
  period_wise: { monthly: Array<{ month: string; revenue: number }> };
};

function formatCurrency(amount: number) {
  return `₹${amount.toLocaleString("en-IN")}`;
}

const COMPACT_CURRENCY_FORMATTER = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  notation: "compact",
  maximumFractionDigits: 1
});

function formatCompactCurrency(amount: number) {
  return COMPACT_CURRENCY_FORMATTER.format(amount);
}

function formatMonthLabel(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(year, monthNumber - 1, 1).toLocaleDateString("en-IN", {
    month: "short",
    year: "2-digit"
  });
}

export default function PartnerDashboardPage() {
  const router = useRouter();
  const [revenue, setRevenue] = useState<RevenueAnalytics | null>(null);
  const searchParams = useSearchParams();
  const weekStart = searchParams.get("week") ?? getDefaultWeekStart();
  const bookingStatus =
    (searchParams.get("status") as PartnerBookingTab) ??
    (searchParams.get("tab") as PartnerBookingTab) ??
    "all";

  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterOpen, setFilterOpen] = useState(false);

  const range = useMemo(() => getWeekRangeFromStart(weekStart), [weekStart]);
  const vehiclePerformance = useMemo(
    () => [...(revenue?.vehicle_wise ?? [])].sort((a, b) => b.revenue - a.revenue),
    [revenue]
  );
  const monthlyRevenue = useMemo(
    () =>
      [...(revenue?.period_wise.monthly ?? [])]
        .sort((a, b) => a.month.localeCompare(b.month))
        .slice(-6),
    [revenue]
  );
  const maxMonthlyRevenue = Math.max(0, ...monthlyRevenue.map((period) => period.revenue));

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSummary(null);
    setRevenue(null);
    try {
      const params = new URLSearchParams({ from: range.from, to: range.to });
      if (bookingStatus !== "all") params.set("status", bookingStatus);
      const [res, revenueRes] = await Promise.all([
        fetch(`/api/partner/dashboard?${params}`, { credentials: "include" }),
        fetch("/api/partner/revenue", { credentials: "include" })
      ]);
      const [json, revenueJson] = await Promise.all([res.json(), revenueRes.json()]);
      if (!res.ok || !json.ok) {
        setError(json?.error?.message ?? "Failed to load dashboard");
        return;
      }
      setSummary(json.data);
      if (!revenueRes.ok || !revenueJson.ok) {
        setRevenue(null);
        setError(revenueJson?.error?.message ?? "Failed to load investor revenue analytics");
        return;
      }
      setRevenue(revenueJson.data);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [range.from, range.to, bookingStatus]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  function updateParams(next: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) {
      if (!value) params.delete(key);
      else params.set(key, value);
    }
    router.replace(`/partner?${params.toString()}`);
  }

  return (
    <main className="partner-dashboard-page">
      <PartnerPageHeader
        title="Investor dashboard"
        subtitle={formatDateRangeLabel(range.from, range.to)}
        onFilterClick={() => setFilterOpen(true)}
      />

      {error && summary ? (
        <div className="partner-error-banner" role="alert">
          <span>{error}</span>
          <button type="button" className="partner-error-retry" onClick={() => void loadDashboard()} disabled={loading}>
            Retry
          </button>
        </div>
      ) : null}

      {loading ? (
        <PartnerDashboardSkeleton />
      ) : summary ? (
        <>
          <section className="partner-kpi-grid" aria-label="Fleet and booking summary">
            <PartnerKpiCard
              icon="bike"
              label="Vehicles"
              value={summary.total_vehicles}
              hint="Assigned to your account"
            />
            <PartnerKpiCard
              icon="calendar"
              label="Bookings"
              value={summary.total_bookings}
              hint="Selected week and booking filter"
            />
            <PartnerKpiCard
              icon="money"
              label="Gross booking value"
              value={formatCurrency(summary.total_revenue)}
              hint="Paid-status booking totals; not your payout"
            />
            <PartnerKpiCard
              icon="location"
              label="Ongoing bookings"
              value={summary.active_rides}
              hint="Created in the selected week; booking filter applies"
            />
          </section>

          <div className="partner-analytics-grid partner-dashboard-top-grid">
            <section className="card partner-panel">
              <div className="partner-panel-head">
                <div>
                  <h2 className="partner-panel-title">Fleet tracking</h2>
                  <p className="partner-panel-subtitle">Latest vehicle location status</p>
                </div>
                <Link className="partner-panel-link" href="/partner/tracking">View live tracking</Link>
              </div>
              <StatusDonut breakdown={summary.status_breakdown} />
            </section>

            <section className="card partner-panel">
              <div className="partner-panel-head partner-bookings-head">
                <div>
                  <h2 className="partner-panel-title">Booking activity</h2>
                  <p className="partner-panel-subtitle">Selected week, grouped by booking creation day</p>
                </div>
                <div className="partner-tab-row" aria-label="Filter bookings by status">
                  {PARTNER_BOOKING_TABS.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      className={`partner-tab${bookingStatus === tab.id ? " active" : ""}`}
                      aria-pressed={bookingStatus === tab.id}
                      onClick={() => updateParams({ status: tab.id === "all" ? null : tab.id })}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>
              <BookingsWeekChart points={summary.bookings_by_weekday} />
            </section>
          </div>

          <div className="partner-analytics-grid partner-dashboard-lower-grid">
            <section className="card partner-panel">
              <div className="partner-panel-head">
                <div>
                  <h2 className="partner-panel-title">Vehicle booking value</h2>
                  <p className="partner-panel-subtitle">All-time paid-status booking totals by vehicle</p>
                </div>
                <Link className="partner-panel-link" href="/partner/vehicles">View vehicles</Link>
              </div>
              {revenue ? (
                <div className="overflow-x-auto">
                  <table className="partner-performance-table">
                    <caption className="sr-only">Booking counts and paid-status booking totals by vehicle</caption>
                    <thead>
                      <tr>
                        <th scope="col">Vehicle</th>
                        <th scope="col">Bookings</th>
                        <th scope="col" className="text-right">Booking value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {vehiclePerformance.map((vehicle) => (
                        <tr key={vehicle.vehicle_id}>
                          <td>
                            <span className="partner-vehicle-name">{vehicle.vehicle_label}</span>
                            {vehicle.registration_number ? (
                              <span className="partner-vehicle-registration">{vehicle.registration_number}</span>
                            ) : null}
                          </td>
                          <td>{vehicle.booking_count}</td>
                          <td className="text-right">{formatCurrency(vehicle.revenue)}</td>
                        </tr>
                      ))}
                      {!vehiclePerformance.length ? (
                        <tr>
                          <td colSpan={3} className="partner-performance-empty">No booking activity for your vehicles yet.</td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="partner-dashboard-empty">Vehicle revenue details are unavailable.</p>
              )}
            </section>

            <section className="card partner-panel">
              <div className="partner-panel-head">
                <div>
                  <h2 className="partner-panel-title">Booking value summary</h2>
                  <p className="partner-panel-subtitle">All-time booking totals by status; not payouts or profit</p>
                </div>
              </div>
              {revenue ? (
                <>
                  <div className="partner-revenue-totals">
                    <div>
                      <span>Paid-status booking value</span>
                      <strong>{formatCurrency(revenue.totals.gross_revenue)}</strong>
                    </div>
                    <div>
                      <span>In review or awaiting payment</span>
                      <strong>{formatCurrency(revenue.totals.pending_revenue)}</strong>
                      <small>Quoted value; not collected</small>
                    </div>
                    <div>
                      <span>Completed booking value</span>
                      <strong>{formatCurrency(revenue.totals.completed_revenue)}</strong>
                    </div>
                  </div>

                  <div className="partner-monthly-heading">
                    <h3>Paid-status booking value by month</h3>
                    <span>By booking creation month · latest 6 active months</span>
                  </div>
                  {monthlyRevenue.length ? (
                    <div className="partner-monthly-chart" role="list" aria-label="Monthly value from paid-status bookings">
                      {monthlyRevenue.map((period) => {
                        const monthLabel = formatMonthLabel(period.month);
                        const barHeight = maxMonthlyRevenue
                          ? Math.max(4, (period.revenue / maxMonthlyRevenue) * 100)
                          : 0;
                        return (
                          <div
                            key={period.month}
                            className="partner-monthly-column"
                            role="listitem"
                            aria-label={`${monthLabel}: ${formatCurrency(period.revenue)}`}
                          >
                            <span className="partner-monthly-value" aria-hidden="true">
                              {formatCompactCurrency(period.revenue)}
                            </span>
                            <div className="partner-monthly-track" aria-hidden="true">
                              <span style={{ height: `${barHeight}%` }} />
                            </div>
                            <span className="partner-monthly-label" aria-hidden="true">{monthLabel}</span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="partner-dashboard-empty">Paid booking totals will appear here.</p>
                  )}
                </>
              ) : (
                <p className="partner-dashboard-empty">Revenue details are unavailable.</p>
              )}
            </section>
          </div>
        </>
      ) : (
        <div className="partner-load-error" role="alert">
          <div>
            <h2>Dashboard data couldn’t be loaded</h2>
            <p>{error ?? "Check your connection, then try again."}</p>
          </div>
          <button type="button" className="btn btn-secondary" onClick={() => void loadDashboard()} disabled={loading}>
            Try again
          </button>
        </div>
      )}

      <PartnerFilterDrawer
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        weekStart={weekStart}
        onApply={(nextWeek) => updateParams({ week: nextWeek })}
        onReset={() => updateParams({ week: getDefaultWeekStart() })}
      />
    </main>
  );
}
