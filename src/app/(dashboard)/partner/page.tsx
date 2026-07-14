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

type DashboardSummary = {
  total_vehicles: number;
  total_bookings: number;
  total_revenue: number;
  active_rides: number;
  status_breakdown: { idle: number; halt: number; running: number; waiting: number };
  bookings_by_weekday: Array<{ day: string; count: number }>;
};

export default function PartnerDashboardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const weekStart = searchParams.get("week") ?? getDefaultWeekStart();
  const bookingTab = (searchParams.get("tab") as PartnerBookingTab) ?? "all";

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
      if (bookingTab !== "all") params.set("status", bookingTab);
      const res = await fetch(`/api/partner/dashboard?${params}`, { credentials: "include" });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json?.error?.message ?? "Failed to load dashboard");
        return;
      }
      setSummary(json.data);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [range.from, range.to, bookingTab]);

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
        title="Dashboard"
        subtitle={`On This Week · ${formatDateRangeLabel(range.from, range.to)}`}
        onFilterClick={() => setFilterOpen(true)}
      />

      {error ? <div className="error-banner mb-4">{error}</div> : null}
      {loading && !summary ? <div className="text-sm text-muted mb-4">Loading dashboard…</div> : null}

      <div className="partner-kpi-grid">
        <PartnerKpiCard icon="bike" label="Total Vehicles" value={summary?.total_vehicles ?? 0} />
        <PartnerKpiCard icon="calendar" label="Total Bookings" value={summary?.total_bookings ?? 0} />
        <PartnerKpiCard
          icon="money"
          label="Total Revenue"
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
                  className={`partner-tab${bookingTab === tab.id ? " active" : ""}`}
                  onClick={() => updateParams({ tab: tab.id === "all" ? null : tab.id })}
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
