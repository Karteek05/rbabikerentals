import { requireActor } from "@/lib/auth/context";
import { approveKyc } from "@/lib/kyc/service";
import { ok, fromError } from "@/lib/utils/http";

export async function POST(
  request: Request,
  context: { params: Promise<{ userId: string }> }
) {
  try {
    const actor = await requireActor(request, ["admin"]);
    const { userId } = await context.params;
    const record = await approveKyc(userId, actor.userId);
    return ok({ kyc: record });
  } catch (error) {
    return fromError(error);
  }
}

