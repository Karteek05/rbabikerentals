import {
  getUserOrThrow,
  listBookings,
  listUsersByIds,
  listVehicleBlocksByVehicleIds,
  listVehicles,
  listVehiclesByOwner
} from "@/lib/data/repository";
import type { Booking, BookingStatus, User, Vehicle, VehicleBlockWindow } from "@/lib/types/domain";
import { ApiException } from "@/lib/utils/errors";

const PAID_REVENUE_STATUSES = new Set<BookingStatus>([
  "confirmed",
  "ongoing",
  "extended",
  "completed"
]);

const PENDING_REVENUE_STATUSES = new Set<BookingStatus>([
  "admin_review",
  "payment_pending"
]);

const ACTIVE_BOOKING_STATUSES = new Set<BookingStatus>([
  "pending_kyc",
  "admin_review",
  "payment_pending",
  "confirmed",
  "ongoing",
  "extension_requested",
  "extended"
]);

const BOOKING_STATUS_PRIORITY: BookingStatus[] = [
  "ongoing",
  "extended",
  "extension_requested",
  "confirmed",
  "payment_pending",
  "admin_review",
  "pending_kyc"
];

const UPCOMING_STATUSES = new Set<BookingStatus>([
  "pending_kyc",
  "admin_review",
  "payment_pending",
  "confirmed"
]);

const ONGOING_STATUSES = new Set<BookingStatus>([
  "ongoing",
  "extension_requested",
  "extended"
]);

export type VehiclePositionStatus = "running" | "waiting" | "halt" | "idle";
export type PartnerBookingTab = "all" | "upcoming" | "ongoing" | "completed" | "cancelled";

export type PartnerVehicleRow = {
  id: string;
  brand: string;
  model: string;
  category: Vehicle["category"];
  is_active: boolean;
  position: VehiclePositionStatus;
  station: string | null;
  partner_name: string;
  registration_number: string | null;
  chassis_number: string | null;
};

export type PartnerBookingRow = {
  id: string;
  vehicle_id: string;
  status: BookingStatus;
  pickup_at: string;
  drop_at: string;
  pickup_zone: string | null;
  created_at: string;
  total_payable: number;
  payment_status: "paid" | "pending" | "unpaid";
  customer_name: string;
  customer_phone: string;
};

function sumRevenue(bookings: Booking[]) {
  return bookings.reduce((sum, booking) => sum + booking.quote.total_payable, 0);
}

function assertPartnerAccess(role: User["role"]) {
  if (role !== "partner_investor" && role !== "admin") {
    throw new ApiException(403, "forbidden", "Only partner/investor or admin can access partner data.");
  }
}

async function getPartnerFleetContext(userId: string) {
  const user = await getUserOrThrow(userId);
  assertPartnerAccess(user.role);

  const vehicles =
    user.role === "admin" ? await listVehicles() : await listVehiclesByOwner(userId);
  const ownedVehicleIds = new Set(vehicles.map((vehicle) => vehicle.id));
  const bookings = (await listBookings()).filter((booking) =>
    ownedVehicleIds.has(booking.vehicle_id)
  );
  const blocks = await listVehicleBlocksByVehicleIds(vehicles.map((vehicle) => vehicle.id));

  return { user, vehicles, bookings, blocks, ownedVehicleIds };
}

export function isBlockActive(block: VehicleBlockWindow, now = new Date()) {
  const start = new Date(block.starts_at).getTime();
  const end = new Date(block.ends_at).getTime();
  const ts = now.getTime();
  return start <= ts && ts <= end;
}

export function getActiveBookingForVehicle(
  bookings: Booking[],
  vehicleId: string
): Booking | null {
  const vehicleBookings = bookings.filter((booking) => booking.vehicle_id === vehicleId);
  for (const status of BOOKING_STATUS_PRIORITY) {
    const match = vehicleBookings.find((booking) => booking.status === status);
    if (match) return match;
  }
  return null;
}

export function deriveVehiclePosition(
  vehicle: Vehicle,
  activeBooking: Booking | null,
  hasActiveBlock: boolean
): VehiclePositionStatus {
  if (hasActiveBlock) return "halt";
  if (!vehicle.is_active) return "idle";
  if (activeBooking) {
    if (activeBooking.status === "ongoing" || activeBooking.status === "extended" || activeBooking.status === "extension_requested") {
      return "running";
    }
    if (activeBooking.status === "confirmed") return "waiting";
  }
  return "idle";
}

export function maskPartnerName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "—";
  return parts
    .map((part) => {
      if (part.length <= 2) return `${part[0]}*`;
      return `${part[0]}${"*".repeat(part.length - 2)}${part[part.length - 1]}`;
    })
    .join(" ");
}

export function maskPartnerPhone(phone: string | null | undefined) {
  if (!phone) return "—";
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 2) return "—";
  return `${"*".repeat(Math.max(digits.length - 2, 4))}${digits.slice(-2)}`;
}

function bookingPaymentStatus(status: BookingStatus): PartnerBookingRow["payment_status"] {
  if (PAID_REVENUE_STATUSES.has(status)) return "paid";
  if (PENDING_REVENUE_STATUSES.has(status)) return "pending";
  return "unpaid";
}

export function filterBookingsByTab(bookings: Booking[], tab: PartnerBookingTab) {
  if (tab === "all") return bookings;
  if (tab === "upcoming") {
    return bookings.filter((booking) => UPCOMING_STATUSES.has(booking.status));
  }
  if (tab === "ongoing") {
    return bookings.filter((booking) => ONGOING_STATUSES.has(booking.status));
  }
  if (tab === "completed") {
    return bookings.filter((booking) => booking.status === "completed");
  }
  return bookings.filter((booking) => booking.status === "cancelled");
}

export function filterBookingsByDateRange(
  bookings: Booking[],
  from?: string,
  to?: string
) {
  if (!from && !to) return bookings;
  const fromMs = from ? new Date(from).getTime() : 0;
  const toMs = to ? new Date(to).getTime() + 24 * 60 * 60 * 1000 - 1 : Number.POSITIVE_INFINITY;
  return bookings.filter((booking) => {
    const ts = new Date(booking.created_at).getTime();
    return ts >= fromMs && ts <= toMs;
  });
}

function latestStationForVehicle(bookings: Booking[], vehicleId: string) {
  const sorted = bookings
    .filter((booking) => booking.vehicle_id === vehicleId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  return sorted[0]?.pickup_zone ?? sorted[0]?.pickup_address ?? null;
}

export async function getPartnerVehicles(userId: string) {
  const { user, vehicles, bookings, blocks } = await getPartnerFleetContext(userId);
  const now = new Date();
  const activeBlocks = blocks.filter((block) => isBlockActive(block, now));
  const blockedVehicleIds = new Set(activeBlocks.map((block) => block.vehicle_id));

  const items: PartnerVehicleRow[] = vehicles.map((vehicle) => {
    const activeBooking = getActiveBookingForVehicle(bookings, vehicle.id);
    return {
      id: vehicle.id,
      brand: vehicle.brand,
      model: vehicle.model,
      category: vehicle.category,
      is_active: vehicle.is_active,
      position: deriveVehiclePosition(
        vehicle,
        activeBooking,
        blockedVehicleIds.has(vehicle.id)
      ),
      station: latestStationForVehicle(bookings, vehicle.id),
      partner_name: user.name,
      registration_number: vehicle.registration_number ?? null,
      chassis_number: vehicle.chassis_number ?? null
    };
  });

  const status_breakdown = { idle: 0, halt: 0, running: 0, waiting: 0 };
  for (const item of items) {
    status_breakdown[item.position] += 1;
  }

  return { items, status_breakdown, total: items.length };
}

export async function getPartnerBookings(
  userId: string,
  filters?: { status?: PartnerBookingTab; from?: string; to?: string }
) {
  const { bookings } = await getPartnerFleetContext(userId);
  const tab = filters?.status ?? "all";
  let filtered = filterBookingsByTab(bookings, tab);
  filtered = filterBookingsByDateRange(filtered, filters?.from, filters?.to);
  filtered.sort((a, b) => b.created_at.localeCompare(a.created_at));

  const users = await listUsersByIds(filtered.map((booking) => booking.user_id));
  const userMap = new Map(users.map((entry) => [entry.id, entry]));

  const items: PartnerBookingRow[] = filtered.map((booking) => {
    const customer = userMap.get(booking.user_id);
    return {
      id: booking.id,
      vehicle_id: booking.vehicle_id,
      status: booking.status,
      pickup_at: booking.pickup_at,
      drop_at: booking.drop_at,
      pickup_zone: booking.pickup_zone ?? null,
      created_at: booking.created_at,
      total_payable: booking.quote.total_payable,
      payment_status: bookingPaymentStatus(booking.status),
      customer_name: maskPartnerName(customer?.name ?? "Customer"),
      customer_phone: maskPartnerPhone(customer?.phone)
    };
  });

  return { items, total: items.length };
}

export async function getPartnerDashboardSummary(
  userId: string,
  filters?: { from?: string; to?: string; status?: PartnerBookingTab }
) {
  const { vehicles, bookings } = await getPartnerFleetContext(userId);
  const vehicleData = await getPartnerVehicles(userId);

  let rangedBookings = filterBookingsByDateRange(bookings, filters?.from, filters?.to);
  rangedBookings = filterBookingsByTab(rangedBookings, filters?.status ?? "all");
  const activeRides = rangedBookings.filter((booking) => ONGOING_STATUSES.has(booking.status)).length;

  const weekdayLabels = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday"
  ];
  const bookings_by_weekday = weekdayLabels.map((day, index) => ({
    day,
    count: rangedBookings.filter((booking) => new Date(booking.created_at).getDay() === index)
      .length
  }));

  const total_revenue = rangedBookings
    .filter((booking) => PAID_REVENUE_STATUSES.has(booking.status))
    .reduce((sum, booking) => sum + booking.quote.total_payable, 0);

  return {
    total_vehicles: vehicles.length,
    total_bookings: rangedBookings.length,
    total_revenue,
    active_rides: activeRides,
    status_breakdown: vehicleData.status_breakdown,
    bookings_by_weekday
  };
}

export async function getPartnerRevenue(userId: string) {
  const user = await getUserOrThrow(userId);
  assertPartnerAccess(user.role);

  const vehicles = user.role === "admin" ? await listVehicles() : await listVehiclesByOwner(userId);
  const ownedVehicleIds = new Set(vehicles.map((vehicle) => vehicle.id));
  const allBookings = await listBookings();
  const bookings = allBookings.filter((booking) => ownedVehicleIds.has(booking.vehicle_id));
  const activeBookings = bookings.filter((booking) => ACTIVE_BOOKING_STATUSES.has(booking.status));
  const paidBookings = bookings.filter((booking) => PAID_REVENUE_STATUSES.has(booking.status));
  const pendingBookings = bookings.filter((booking) => PENDING_REVENUE_STATUSES.has(booking.status));
  const completedBookings = bookings.filter((booking) => booking.status === "completed");

  const bookingWise = bookings.map((booking) => ({
    booking_id: booking.id,
    vehicle_id: booking.vehicle_id,
    status: booking.status,
    total_payable: booking.quote.total_payable,
    counts_toward_revenue: PAID_REVENUE_STATUSES.has(booking.status)
  }));

  const vehicleMap = new Map<string, { booking_count: number; revenue: number }>();
  for (const booking of activeBookings) {
    const entry = vehicleMap.get(booking.vehicle_id) ?? {
      booking_count: 0,
      revenue: 0
    };
    entry.booking_count += 1;
    if (PAID_REVENUE_STATUSES.has(booking.status)) {
      entry.revenue += booking.quote.total_payable;
    }
    vehicleMap.set(booking.vehicle_id, entry);
  }

  const weeklyMap = new Map<string, number>();
  const monthlyMap = new Map<string, number>();

  for (const booking of paidBookings) {
    const weekKey = getWeekKey(booking.created_at);
    const monthKey = booking.created_at.slice(0, 7);

    weeklyMap.set(weekKey, (weeklyMap.get(weekKey) ?? 0) + booking.quote.total_payable);
    monthlyMap.set(monthKey, (monthlyMap.get(monthKey) ?? 0) + booking.quote.total_payable);
  }

  const grossRevenue = sumRevenue(paidBookings);
  const pendingRevenue = sumRevenue(pendingBookings);
  const completedRevenue = sumRevenue(completedBookings);
  const vehicleWise = Array.from(vehicleMap.entries()).map(([vehicle_id, value]) => ({
    vehicle_id,
    booking_count: value.booking_count,
    revenue: value.revenue
  }));

  return {
    totals: {
      booking_count: activeBookings.length,
      gross_revenue: grossRevenue,
      pending_revenue: pendingRevenue,
      completed_revenue: completedRevenue
    },
    booking_wise: bookingWise,
    vehicle_wise: vehicleWise,
    period_wise: {
      weekly: Array.from(weeklyMap.entries()).map(([week, revenue]) => ({
        week,
        revenue
      })),
      monthly: Array.from(monthlyMap.entries()).map(([month, revenue]) => ({
        month,
        revenue
      }))
    },
    total_revenue: grossRevenue,
    pending_revenue: pendingRevenue,
    bookings_count: activeBookings.length,
    vehicles: vehicleWise.map((vehicle) => ({
      vehicle_id: vehicle.vehicle_id,
      revenue: vehicle.revenue,
      bookings: vehicle.booking_count
    })),
    by_period: Array.from(monthlyMap.entries()).map(([period, revenue]) => ({
      period,
      revenue,
      bookings: paidBookings.filter((booking) => booking.created_at.slice(0, 7) === period).length
    }))
  };
}

function getWeekKey(value: string) {
  const date = new Date(value);
  const day = date.getUTCDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(date);
  monday.setUTCDate(date.getUTCDate() + diffToMonday);
  return monday.toISOString().slice(0, 10);
}
