import { getFleetAvailability } from "@/lib/fleet/availability";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import { resolveBookingScheduleFromParams } from "@/lib/bookings/schedule";
import { ApiException } from "@/lib/utils/errors";
import { durationParamToPackageKey } from "@/lib/bookings/schedule";
import { ok, fromError } from "@/lib/utils/http";

export async function GET(request: Request) {
	try {
		const url = new URL(request.url);
		const client =
			request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
			request.headers.get("x-real-ip") ||
			"local";
		const limit = await consumeRateLimit(`availability:${client}`, 60, 60_000);
		if (!limit.allowed)
			throw new ApiException(
				429,
				"rate_limited",
				"Too many availability requests. Try again shortly.",
			);
		const packageKey = durationParamToPackageKey(
			url.searchParams.get("duration"),
		);
		const rawPickup = url.searchParams.get("pickup_at");
		const rawDrop = url.searchParams.get("drop_at");
		if ((rawPickup && !rawDrop) || (!rawPickup && rawDrop))
			throw new ApiException(
				400,
				"invalid_window",
				"pickup_at and drop_at must be supplied together.",
			);
		if (rawPickup && rawDrop) {
			const pickupMs = Date.parse(rawPickup);
			const dropMs = Date.parse(rawDrop);
			const maxWindowMs = 90 * 24 * 60 * 60 * 1000;
			if (
				!Number.isFinite(pickupMs) ||
				!Number.isFinite(dropMs) ||
				pickupMs >= dropMs ||
				dropMs - pickupMs > maxWindowMs
			) {
				throw new ApiException(
					400,
					"invalid_window",
					"Availability window must be valid and no longer than 90 days.",
				);
			}
		}
		const schedule = resolveBookingScheduleFromParams(
			url.searchParams,
			packageKey,
		);

		const items = await getFleetAvailability({
			pickupAt: schedule.pickupAt,
			dropAt: schedule.dropAt,
		});

		return ok({
			window: {
				pickup_at: schedule.pickupAt,
				drop_at: schedule.dropAt,
				pickup_zone: schedule.pickupZone,
			},
			items,
		});
	} catch (error) {
		return fromError(error);
	}
}
