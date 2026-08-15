import type { IconName } from "../Icon";

export const PARTNER_NAV: { href: string; icon: IconName; label: string }[] = [
  { href: "/partner", icon: "chart", label: "Dashboard" },
  { href: "/partner/vehicles", icon: "bike", label: "Vehicles" },
  { href: "/partner/bookings", icon: "calendar", label: "Bookings" },
  { href: "/partner/tracking", icon: "location", label: "Live Tracking" }
];

export const PARTNER_BOOKING_TABS = [
  { id: "all", label: "All" },
  { id: "upcoming", label: "Upcoming" },
  { id: "ongoing", label: "Ongoing" },
  { id: "completed", label: "Completed" },
  { id: "cancelled", label: "Cancelled" }
] as const;

export function formatPartnerUserLabel(name: string, id: string) {
  const short = id.replace(/^partner_/, "").slice(0, 8);
  return `${name} [${short}]`;
}

function formatLocalDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getWeekRangeFromStart(weekStart: string) {
  const [year, month, day] = weekStart.split("-").map(Number);
  const end = new Date(year, month - 1, day);
  end.setDate(end.getDate() + 6);
  return { from: weekStart, to: formatLocalDate(end) };
}

export function formatDateRangeLabel(from: string, to: string) {
  const fmt = (value: string) => {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric"
    });
  };
  return `${fmt(from)} – ${fmt(to)}`;
}

export function getDefaultWeekStart() {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  return formatLocalDate(monday);
}
