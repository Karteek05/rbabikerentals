"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
  const [loading, setLoading] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);

  const range = useMemo(() => getWeekRangeFromStart(weekStart), [weekStart]);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
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
    <>
      <PartnerPageHeader
        title="Investor Dashboard"
        subtitle={`${formatDateRangeLabel(range.from, range.to)} · Gross booking analytics`}
        onFilterClick={() => setFilterOpen(true)}
      />

      {error ? <div className="error-banner mb-4">{error}</div> : null}
      {loading && !summary ? (
        <PartnerDashboardSkeleton />
      ) : (
        <>
          <div className="partner-kpi-grid">
            <PartnerKpiCard icon="bike" label="Total Vehicles" value={summary?.total_vehicles ?? 0} />
            <PartnerKpiCard icon="calendar" label="Total Bookings" value={summary?.total_bookings ?? 0} />
            <PartnerKpiCard
              icon="money"
              label="Gross Paid Booking Value"
              value={`₹${(summary?.total_revenue ?? 0).toLocaleString("en-IN")}`}
            />
            <PartnerKpiCard icon="location" label="Active Rides" value={summary?.active_rides ?? 0} />
          </div>

          <div className="partner-analytics-grid">
            <section className="card partner-panel">
              <h2 className="partner-panel-title">Vehicle Status</h2>
              {summary ? (
                <StatusDonut breakdown={summary.status_breakdown} />
              ) : (
                <div className="partner-donut-empty">
                  <p>—</p>
                </div>
              )}
            </section>

            <section className="card partner-panel">
              <div className="partner-panel-head">
                <h2 className="partner-panel-title">Bookings</h2>
                <div className="partner-tab-row">
                  {PARTNER_BOOKING_TABS.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      className={`partner-tab${bookingStatus === tab.id ? " active" : ""}`}
                      onClick={() => updateParams({ status: tab.id === "all" ? null : tab.id })}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>
              {summary ? (
                <BookingsWeekChart points={summary.bookings_by_weekday} />
              ) : (
                <div className="partner-week-chart partner-week-chart-empty">No booking trend yet</div>
              )}
            </section>
          </div>
            <div className="partner-analytics-grid mt-4">
              <section className="card partner-panel">
                <h2 className="partner-panel-title">Vehicle performance</h2>
                <p className="mb-3 text-xs text-muted">
                  Values are gross booking totals, not investor payouts or profit.
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr>
                        <th className="py-2">Vehicle</th>
                        <th className="py-2">Bookings</th>
                        <th className="py-2 text-right">Paid value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(revenue?.vehicle_wise ?? []).map((vehicle) => (
                        <tr key={vehicle.vehicle_id} className="border-t border-[color:var(--color-line)]">
                          <td className="py-2 font-medium">
                            {vehicle.vehicle_label}
                            {vehicle.registration_number ? (
                              <span className="block text-xs font-normal text-muted">
                                {vehicle.registration_number}
                              </span>
                            ) : null}
                          </td>
                          <td className="py-2">{vehicle.booking_count}</td>
                          <td className="py-2 text-right">₹{vehicle.revenue.toLocaleString("en-IN")}</td>
                        </tr>
                      ))}
                      {!revenue?.vehicle_wise.length ? (
                        <tr>
                          <td colSpan={3} className="py-3 text-center text-muted">No vehicle revenue yet.</td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </section>
              <section className="card partner-panel">
                <h2 className="partner-panel-title">Revenue summary</h2>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-xs text-muted">All-time gross paid value</p>
                    <p className="text-lg font-bold">₹{(revenue?.totals.gross_revenue ?? 0).toLocaleString("en-IN")}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted">Pending bookings</p>
                    <p className="text-lg font-bold">₹{(revenue?.totals.pending_revenue ?? 0).toLocaleString("en-IN")}</p>
                  </div>
                </div>
                <h3 className="mt-4 text-sm font-semibold">Monthly paid booking value</h3>
                <ul className="mt-2 divide-y divide-[color:var(--color-line)]">
                  {(revenue?.period_wise.monthly ?? []).slice().reverse().map((period) => (
                    <li key={period.month} className="flex justify-between gap-3 py-2 text-sm">
                      <span>{new Date(`${period.month}-01T00:00:00`).toLocaleDateString("en-IN", {
                        month: "long",
                        year: "numeric"
                      })}</span>
                      <span className="font-semibold">₹{period.revenue.toLocaleString("en-IN")}</span>
                    </li>
                  ))}
                  {!revenue?.period_wise.monthly.length ? (
                    <li className="py-3 text-sm text-muted">No paid bookings yet.</li>
                  ) : null}
                </ul>
              </section>
            </div>
        </>
      )}

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
