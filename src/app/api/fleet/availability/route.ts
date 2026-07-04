import { getFleetAvailability } from "@/lib/fleet/availability";
import { resolveBookingScheduleFromParams } from "@/lib/bookings/schedule";
import { durationParamToPackageKey } from "@/lib/bookings/schedule";
import { ok, fromError } from "@/lib/utils/http";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const packageKey = durationParamToPackageKey(url.searchParams.get("duration"));
    const schedule = resolveBookingScheduleFromParams(url.searchParams, packageKey);

    const items = await getFleetAvailability({
      pickupAt: schedule.pickupAt,
      dropAt: schedule.dropAt
    });

    return ok({
      window: {
        pickup_at: schedule.pickupAt,
        drop_at: schedule.dropAt,
        pickup_zone: schedule.pickupZone
      },
      items
    });
  } catch (error) {
    return fromError(error);
  }
}
