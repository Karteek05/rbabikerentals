import {
  getUserOrThrow,
  listBookings,
  listVehicles,
  listVehiclesByOwner
} from "@/lib/data/repository";
import type { Booking, BookingStatus } from "@/lib/types/domain";
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

function sumRevenue(bookings: Booking[]) {
  return bookings.reduce((sum, booking) => sum + booking.quote.total_payable, 0);
}

export async function getPartnerRevenue(userId: string) {
  const user = await getUserOrThrow(userId);
  if (user.role !== "partner_investor" && user.role !== "admin") {
    throw new ApiException(403, "forbidden", "Only partner/investor or admin can view revenue.");
  }

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
