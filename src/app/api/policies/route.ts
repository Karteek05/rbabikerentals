import { getOperationalPolicy } from "@/lib/data/repository";
import { fromError, ok } from "@/lib/utils/http";

export async function GET() {
  try {
    const policy = await getOperationalPolicy();
    return ok({ cancellation_over_24h_percent: policy.cancellation_over_24h_percent, cancellation_under_24h_percent: policy.cancellation_under_24h_percent });
  } catch (error) { return fromError(error); }
}
