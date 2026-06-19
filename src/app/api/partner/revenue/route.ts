import { requireActor } from "@/lib/auth/context";
import { getPartnerRevenue } from "@/lib/partner/service";
import { ok, fromError } from "@/lib/utils/http";

export async function GET(request: Request) {
  try {
    const actor = await requireActor(request, ["partner_investor", "admin"]);
    const result = await getPartnerRevenue(actor.userId);
    return ok(result);
  } catch (error) {
    return fromError(error);
  }
}
