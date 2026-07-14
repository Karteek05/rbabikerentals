import { requireActor } from "@/lib/auth/context";
import { isApprovedPartner } from "@/lib/auth/partner-access";
import { getUserOrThrow } from "@/lib/data/repository";
import { ok, fromError } from "@/lib/utils/http";

export async function GET(request: Request) {
  try {
    const actor = await requireActor(request);
    const user = await getUserOrThrow(actor.userId);
    return ok({
      user_id: user.id,
      role: user.role,
      partner_application_status: user.partner_application_status ?? null,
      partner_applied_at: user.partner_applied_at ?? null,
      partner_reviewed_at: user.partner_reviewed_at ?? null,
      partner_rejection_reason: user.partner_rejection_reason ?? null,
      partner_business_name: user.partner_business_name ?? null,
      is_approved_partner: isApprovedPartner(user)
    });
  } catch (error) {
    return fromError(error);
  }
}
