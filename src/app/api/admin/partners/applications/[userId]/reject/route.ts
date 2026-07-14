import { requireActor } from "@/lib/auth/context";
import { rejectPartnerApplication } from "@/lib/admin/partner-onboarding-service";
import { ok, fromError, parseJson } from "@/lib/utils/http";
import type { RejectPartnerApplicationRequest } from "@/lib/types/contracts";

type RouteContext = { params: Promise<{ userId: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const actor = await requireActor(request, ["admin"]);
    const { userId } = await context.params;
    const body = await parseJson<RejectPartnerApplicationRequest>(request).catch(
      () => ({}) as RejectPartnerApplicationRequest
    );
    const user = await rejectPartnerApplication(userId, actor, body.reason);
    return ok({ user });
  } catch (error) {
    return fromError(error);
  }
}
