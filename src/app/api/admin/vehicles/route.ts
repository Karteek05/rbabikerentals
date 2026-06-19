import { requireActor } from "@/lib/auth/context";
import {
  createVehicleByAdmin,
  listVehiclesForAdmin
} from "@/lib/admin/vehicle-service";
import type { AdminVehicleUpsertRequest } from "@/lib/types/contracts";
import { fromError, ok, parseJson } from "@/lib/utils/http";

export async function GET(request: Request) {
  try {
    await requireActor(request, ["admin"]);
    const url = new URL(request.url);
    const includeInactive = url.searchParams.get("include_inactive") === "true";
    const vehicles = await listVehiclesForAdmin({ includeInactive });
    return ok({ vehicles });
  } catch (error) {
    return fromError(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireActor(request, ["admin"]);
    const body = await parseJson<AdminVehicleUpsertRequest>(request);
    const vehicle = await createVehicleByAdmin(body, actor);
    return ok({ vehicle }, 201);
  } catch (error) {
    return fromError(error);
  }
}
