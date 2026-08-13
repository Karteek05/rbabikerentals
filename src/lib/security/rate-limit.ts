import {
	getSupabaseServiceClient,
	isSupabaseConfigured,
} from "@/lib/db/supabase-client";

export type RateLimitResult = {
	allowed: boolean;
	remaining: number;
	retryAfterSeconds: number;
	distributed: boolean;
};

type Bucket = { count: number; resetAt: number };
const localBuckets = new Map<string, Bucket>();

function consumeLocal(
	key: string,
	limit: number,
	windowMs: number,
): RateLimitResult {
	const now = Date.now();
	const current = localBuckets.get(key);
	const bucket =
		!current || current.resetAt <= now
			? { count: 0, resetAt: now + windowMs }
			: current;
	bucket.count += 1;
	localBuckets.set(key, bucket);
	const allowed = bucket.count <= limit;
	return {
		allowed,
		remaining: Math.max(0, limit - bucket.count),
		retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
		distributed: false,
	};
}

export async function consumeRateLimit(
	key: string,
	limit: number,
	windowMs: number,
	options?: { failClosed?: boolean },
): Promise<RateLimitResult> {
	if (!isSupabaseConfigured()) return consumeLocal(key, limit, windowMs);
	try {
		const supabase = getSupabaseServiceClient();
		const { data, error } = await supabase.rpc("consume_api_rate_limit", {
			p_key: key,
			p_limit: limit,
			p_window_seconds: Math.ceil(windowMs / 1000),
		});
		if (error || !data) {
			return options?.failClosed
				? {
						allowed: false,
						remaining: 0,
						retryAfterSeconds: Math.max(1, Math.ceil(windowMs / 1000)),
						distributed: false,
					}
				: consumeLocal(key, limit, windowMs);
		}
		const row = Array.isArray(data) ? data[0] : data;
		return {
			allowed: Boolean(row.allowed),
			remaining: Number(row.remaining ?? 0),
			retryAfterSeconds: Math.max(1, Number(row.retry_after_seconds ?? 1)),
			distributed: true,
		};
	} catch {
		return options?.failClosed
			? {
					allowed: false,
					remaining: 0,
					retryAfterSeconds: Math.max(1, Math.ceil(windowMs / 1000)),
					distributed: false,
				}
			: consumeLocal(key, limit, windowMs);
	}
}

export function resetLocalRateLimitsForTests() {
	localBuckets.clear();
}
