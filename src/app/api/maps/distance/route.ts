import { requireActor } from "@/lib/auth/context";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import { ApiException } from "@/lib/utils/errors";
import { distanceMatrix } from "@/lib/integrations/google-maps";
import type { MapsDistanceRequest } from "@/lib/types/contracts";
import { fromError, ok, parseJson } from "@/lib/utils/http";

export async function POST(request: Request) {
	try {
		const actor = await requireActor(request, [
			"customer",
			"partner_investor",
			"admin",
		]);
		const limit = await consumeRateLimit(
			`maps:distance:${actor.userId}`,
			60,
			60_000,
		);
		if (!limit.allowed)
			throw new ApiException(
				429,
				"rate_limited",
				"Too many map requests. Try again shortly.",
			);
		const body = await parseJson<MapsDistanceRequest>(request);
		const result = await distanceMatrix(body);
		return ok(result);
	} catch (error) {
		return fromError(error);
	}
}
