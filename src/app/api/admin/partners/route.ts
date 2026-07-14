import { requireActor } from "@/lib/auth/context";
import { listApprovedPartnersForAdmin } from "@/lib/admin/partner-onboarding-service";
import { ok, fromError } from "@/lib/utils/http";

export async function GET(request: Request) {
  try {
    await requireActor(request, ["admin"]);
    const partners = await listApprovedPartnersForAdmin();
    return ok({ partners });
  } catch (error) {
    return fromError(error);
  }
}
