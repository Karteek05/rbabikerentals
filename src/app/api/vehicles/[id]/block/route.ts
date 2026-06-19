import { requireActor } from "@/lib/auth/context";
import { blockVehicle } from "@/lib/vehicles/service";
import type { BlockVehicleRequest } from "@/lib/types/contracts";
import { parseJson, ok, fromError } from "@/lib/utils/http";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireActor(request, ["partner_investor", "admin"]);
    const body = await parseJson<BlockVehicleRequest>(request);
    const { id } = await context.params;
    const result = await blockVehicle(id, body, actor);
    return ok(result, 201);
  } catch (error) {
    return fromError(error);
  }
}
