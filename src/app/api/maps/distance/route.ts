import { requireActor } from "@/lib/auth/context";
import { distanceMatrix } from "@/lib/integrations/google-maps";
import type { MapsDistanceRequest } from "@/lib/types/contracts";
import { fromError, ok, parseJson } from "@/lib/utils/http";

export async function POST(request: Request) {
  try {
    await requireActor(request, ["customer", "partner_investor", "admin"]);
    const body = await parseJson<MapsDistanceRequest>(request);
    const result = await distanceMatrix(body);
    return ok(result);
  } catch (error) {
    return fromError(error);
  }
}
