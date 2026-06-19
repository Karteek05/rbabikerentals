import { requireActor } from "@/lib/auth/context";
import { listPendingKycManualReview } from "@/lib/kyc/service";
import { ok, fromError } from "@/lib/utils/http";

export async function GET(request: Request) {
  try {
    await requireActor(request, ["admin"]);
    const items = await listPendingKycManualReview();
    return ok({ items });
  } catch (error) {
    return fromError(error);
  }
}

