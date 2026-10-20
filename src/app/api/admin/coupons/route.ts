import { requireActor } from "@/lib/auth/context";
import { deleteCoupon, listCoupons, saveCoupon } from "@/lib/data/repository";
import { recordAudit } from "@/lib/audit/service";
import { ApiException } from "@/lib/utils/errors";
import { fromError, ok, parseJson } from "@/lib/utils/http";

export async function GET(request: Request) {
  try { await requireActor(request, ["admin"]); return ok({ items: await listCoupons() }); }
  catch (error) { return fromError(error); }
}

export async function POST(request: Request) {
  try {
    const actor = await requireActor(request, ["admin"]);
    const body = await parseJson<{ code?: string; discount_percent?: number; active?: boolean; starts_at?: string | null; ends_at?: string | null }>(request);
    const code = body.code?.trim().toUpperCase();
    if (!code || !/^[A-Z0-9_-]{2,40}$/.test(code) || !Number.isFinite(body.discount_percent) || (body.discount_percent ?? -1) < 0 || (body.discount_percent ?? 101) > 100) throw new ApiException(400, "invalid_coupon", "Enter a code of 2–40 letters/numbers and a discount from 0 to 100%.");
    const coupon = await saveCoupon({ code, discount_percent: body.discount_percent!, active: body.active !== false, starts_at: body.starts_at || null, ends_at: body.ends_at || null }, actor.userId);
    await recordAudit({ actorId: actor.userId, actorRole: "admin", action: "admin.coupon_upsert", resourceType: "coupon", resourceId: code, metadata: { coupon } });
    return ok({ coupon });
  } catch (error) { return fromError(error); }
}
export async function DELETE(request: Request) {
  try {
    const actor = await requireActor(request, ["admin"]);
    const body = await parseJson<{ code?: string }>(request);
    const code = body.code?.trim().toUpperCase();
    if (!code || !/^[A-Z0-9_-]{2,40}$/.test(code)) {
      throw new ApiException(400, "invalid_coupon", "Choose a valid promotion code.");
    }
    if (!(await deleteCoupon(code))) {
      throw new ApiException(404, "coupon_not_found", "Promotion not found.");
    }
    await recordAudit({
      actorId: actor.userId,
      actorRole: "admin",
      action: "admin.coupon_delete",
      resourceType: "coupon",
      resourceId: code,
      metadata: { code }
    });
    return ok({ code });
  } catch (error) {
    return fromError(error);
  }
}
