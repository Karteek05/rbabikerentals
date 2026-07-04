import {
  getVehicleStockCapacity,
  INVENTORY_HOLDING_STATUSES
} from "@/lib/fleet/availability";
import { getDataMode } from "@/lib/data/repository";
import { getPgPool } from "@/lib/db/pg-pool";
import type { Booking } from "@/lib/types/domain";
import { ApiException } from "@/lib/utils/errors";

const HOLDING_STATUSES = Array.from(INVENTORY_HOLDING_STATUSES);

function getPgErrorMessage(error: unknown) {
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) {
      return message;
    }
  }
  return "Failed to reserve vehicle inventory.";
}

export async function insertBookingWithCapacityGuard(booking: Booking): Promise<Booking> {
  const capacity = getVehicleStockCapacity(booking.vehicle_id);

  if (getDataMode() === "memory") {
    const { countOverlappingInventoryBookings } = await import("@/lib/fleet/availability");
    const overlapping = await countOverlappingInventoryBookings(
      booking.vehicle_id,
      booking.pickup_at,
      booking.drop_at
    );
    if (overlapping >= capacity) {
      throw new ApiException(
        409,
        "vehicle_unavailable",
        "Vehicle has no free units left for the requested time."
      );
    }
    const { insertBooking } = await import("@/lib/data/repository");
    return insertBooking(booking);
  }

  const pool = getPgPool();
  const client = await pool.connect();
  let inTransaction = false;

  try {
    await client.query("BEGIN");
    inTransaction = true;
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [booking.vehicle_id]);

    const countResult = await client.query<{ count: number }>(
      `select count(*)::int as count
       from bookings
       where vehicle_id = $1
         and status::text = any($2::text[])
         and pickup_at < $4
         and drop_at > $3`,
      [booking.vehicle_id, HOLDING_STATUSES, booking.pickup_at, booking.drop_at]
    );

    if ((countResult.rows[0]?.count ?? 0) >= capacity) {
      throw new ApiException(
        409,
        "vehicle_unavailable",
        "Vehicle has no free units left for the requested time."
      );
    }

    const insertResult = await client.query<Booking>(
      `insert into bookings (
         id, user_id, vehicle_id, city, status, pickup_at, drop_at,
         pickup_zone, pickup_address, pickup_latitude, pickup_longitude,
         km_limit_bucket, km_limit_value, coupon_code, quote, created_at, updated_at
       ) values (
         $1, $2, $3, $4, $5, $6, $7,
         $8, $9, $10, $11,
         $12, $13, $14, $15::jsonb, $16, $17
       )
       returning *`,
      [
        booking.id,
        booking.user_id,
        booking.vehicle_id,
        booking.city,
        booking.status,
        booking.pickup_at,
        booking.drop_at,
        booking.pickup_zone ?? null,
        booking.pickup_address ?? null,
        booking.pickup_latitude ?? null,
        booking.pickup_longitude ?? null,
        booking.km_limit_bucket,
        booking.km_limit_value,
        booking.coupon_code ?? null,
        JSON.stringify(booking.quote),
        booking.created_at,
        booking.updated_at
      ]
    );

    await client.query("COMMIT");
    inTransaction = false;
    return insertResult.rows[0];
  } catch (error) {
    if (inTransaction) {
      await client.query("ROLLBACK");
    }
    if (error instanceof ApiException) {
      throw error;
    }
    console.error("insertBookingWithCapacityGuard failed:", error);
    throw new ApiException(500, "db_error", getPgErrorMessage(error));
  } finally {
    client.release();
  }
}
