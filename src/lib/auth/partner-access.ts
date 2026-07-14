import type { User } from "@/lib/types/domain";
import { getUserOrThrow } from "@/lib/data/repository";
import { ApiException } from "@/lib/utils/errors";
import type { ActorContext } from "@/lib/auth/context";
import { requireActor } from "@/lib/auth/context";

export function isApprovedPartner(user: User) {
  if (user.role !== "partner_investor") return false;
  if (!user.partner_application_status) return true;
  return user.partner_application_status === "approved";
}

export async function requireApprovedPartner(
  request: Request
): Promise<ActorContext> {
  const actor = await requireActor(request, ["partner_investor", "admin"]);
  if (actor.role === "admin") return actor;

  const user = await getUserOrThrow(actor.userId);
  if (user.partner_application_status === "pending") {
    throw new ApiException(
      403,
      "partner_pending_approval",
      "Your partner application is under review."
    );
  }
  if (user.partner_application_status === "rejected") {
    throw new ApiException(
      403,
      "partner_application_rejected",
      "Your partner application was not approved."
    );
  }
  if (!isApprovedPartner(user)) {
    throw new ApiException(403, "forbidden", "Partner access is not enabled for this account.");
  }
  return actor;
}
