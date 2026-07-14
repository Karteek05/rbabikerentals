import { requireActor } from "@/lib/auth/context";
import { approvePartnerApplication } from "@/lib/admin/partner-onboarding-service";
import { ok, fromError } from "@/lib/utils/http";

type RouteContext = { params: Promise<{ userId: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const actor = await requireActor(request, ["admin"]);
    const { userId } = await context.params;
    const user = await approvePartnerApplication(userId, actor);
    return ok({ user });
  } catch (error) {
    return fromError(error);
  }
}
