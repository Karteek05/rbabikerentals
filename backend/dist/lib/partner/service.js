"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPartnerRevenue = getPartnerRevenue;
const repository_1 = require("../../lib/data/repository");
const errors_1 = require("../../lib/utils/errors");
async function getPartnerRevenue(userId) {
    const user = await (0, repository_1.getUserOrThrow)(userId);
    if (user.role !== "partner_investor" && user.role !== "admin") {
        throw new errors_1.ApiException(403, "forbidden", "Only partner/investor or admin can view revenue.");
    }
    const vehicles = user.role === "admin" ? await (0, repository_1.listVehicles)() : await (0, repository_1.listVehiclesByOwner)(userId);
    const ownedVehicleIds = new Set(vehicles.map((vehicle) => vehicle.id));
    const allBookings = await (0, repository_1.listBookings)();
    const bookings = allBookings.filter((booking) => ownedVehicleIds.has(booking.vehicle_id));
    const bookingWise = bookings.map((booking) => ({
        booking_id: booking.id,
        vehicle_id: booking.vehicle_id,
        status: booking.status,
        total_payable: booking.quote.total_payable
    }));
    const vehicleMap = new Map();
    for (const booking of bookings) {
        const entry = vehicleMap.get(booking.vehicle_id) ?? {
            booking_count: 0,
            revenue: 0
        };
        entry.booking_count += 1;
        entry.revenue += booking.quote.total_payable;
        vehicleMap.set(booking.vehicle_id, entry);
    }
    const weeklyMap = new Map();
    const monthlyMap = new Map();
    for (const booking of bookings) {
        const weekKey = getWeekKey(booking.created_at);
        const monthKey = booking.created_at.slice(0, 7);
        weeklyMap.set(weekKey, (weeklyMap.get(weekKey) ?? 0) + booking.quote.total_payable);
        monthlyMap.set(monthKey, (monthlyMap.get(monthKey) ?? 0) + booking.quote.total_payable);
    }
    const completedRevenue = bookings
        .filter((booking) => booking.status === "completed")
        .reduce((sum, booking) => sum + booking.quote.total_payable, 0);
    return {
        totals: {
            booking_count: bookings.length,
            gross_revenue: bookings.reduce((sum, booking) => sum + booking.quote.total_payable, 0),
            completed_revenue: completedRevenue
        },
        booking_wise: bookingWise,
        vehicle_wise: Array.from(vehicleMap.entries()).map(([vehicle_id, value]) => ({
            vehicle_id,
            booking_count: value.booking_count,
            revenue: value.revenue
        })),
        period_wise: {
            weekly: Array.from(weeklyMap.entries()).map(([week, revenue]) => ({
                week,
                revenue
            })),
            monthly: Array.from(monthlyMap.entries()).map(([month, revenue]) => ({
                month,
                revenue
            }))
        }
    };
}
function getWeekKey(value) {
    const date = new Date(value);
    const day = date.getUTCDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    const monday = new Date(date);
    monday.setUTCDate(date.getUTCDate() + diffToMonday);
    return monday.toISOString().slice(0, 10);
}
