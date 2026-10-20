import { requireActor } from "@/lib/auth/context";
import { getOperationalPolicy, listCoupons, saveCoupon, saveOperationalPolicy } from "@/lib/data/repository";
import { recordAudit } from "@/lib/audit/service";
import { fromError, ok, parseJson } from "@/lib/utils/http";
import { ApiException } from "@/lib/utils/errors";

export async function GET(request: Request) {
  try { await requireActor(request, ["admin"]); const [policy, promotions] = await Promise.all([getOperationalPolicy(), listCoupons()]); return ok({ policy, promotions }); }
  catch (error) { return fromError(error); }
}

export async function PATCH(request: Request) {
  try {
    const actor = await requireActor(request, ["admin"]);
    const body = await parseJson<{ cancellation_over_24h_percent?: number; cancellation_under_24h_percent?: number; coupon_code?: string; coupon_discount_percent?: number; coupon_active?: boolean }>(request);
    const previous = await getOperationalPolicy();
    const policy = { gst_percent: 18, cancellation_over_24h_percent: body.cancellation_over_24h_percent ?? previous.cancellation_over_24h_percent, cancellation_under_24h_percent: body.cancellation_under_24h_percent ?? previous.cancellation_under_24h_percent };
    if (Object.values(policy).some((value) => !Number.isFinite(value) || value < 0 || value > 100)) throw new ApiException(400, "invalid_policy", "Policy percentages must be between 0 and 100.");
    if (body.coupon_code?.trim()) {
      const code = body.coupon_code.trim().toUpperCase();
      if (!/^[A-Z0-9_-]{2,40}$/.test(code) || !Number.isFinite(body.coupon_discount_percent) || (body.coupon_discount_percent ?? -1) < 0 || (body.coupon_discount_percent ?? 101) > 100) throw new ApiException(400, "invalid_coupon", "Enter a valid promotion code and discount from 0 to 100%.");
    }
    const saved = await saveOperationalPolicy(policy, actor.userId);
    await recordAudit({ actorId: actor.userId, actorRole: "admin", action: "admin.policy_update", resourceType: "operational_policy", resourceId: "default", metadata: { previous, policy: saved } });
    let promotion = null;
    if (body.coupon_code?.trim()) {
      const code = body.coupon_code.trim().toUpperCase();
      promotion = await saveCoupon({ code, discount_percent: body.coupon_discount_percent!, active: body.coupon_active !== false }, actor.userId);
      await recordAudit({ actorId: actor.userId, actorRole: "admin", action: "admin.coupon_upsert", resourceType: "coupon", resourceId: code, metadata: { coupon: promotion } });
    }
    return ok({ policy: saved, promotion });
  } catch (error) { return fromError(error); }
}
