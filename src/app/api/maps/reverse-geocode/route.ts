import { requireActor } from "@/lib/auth/context";
import { reverseGeocode } from "@/lib/integrations/google-maps";
import type { MapsReverseGeocodeRequest } from "@/lib/types/contracts";
import { fromError, ok, parseJson } from "@/lib/utils/http";

export async function POST(request: Request) {
  try {
    await requireActor(request, ["customer", "partner_investor", "admin"]);
    const body = await parseJson<MapsReverseGeocodeRequest>(request);
    const result = await reverseGeocode(body);
    return ok(result);
  } catch (error) {
    return fromError(error);
  }
}
