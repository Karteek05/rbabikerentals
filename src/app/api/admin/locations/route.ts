import { ApiException } from "@/lib/utils/errors";
import { fromError, ok, parseJson } from "@/lib/utils/http";
import { requireActor } from "@/lib/auth/context";
import { listPickupLocations, savePickupLocation } from "@/lib/data/repository";
import { recordAudit } from "@/lib/audit/service";
import { newId } from "@/lib/utils/ids";

export async function GET(request: Request) {
  try { await requireActor(request, ["admin"]); return ok({ items: await listPickupLocations() }); }
  catch (error) { return fromError(error); }
}

export async function POST(request: Request) {
  try {
    const actor = await requireActor(request, ["admin"]);
    const body = await parseJson<{ id?: string; name?: string; active?: boolean }>(request);
    const name = body.name?.trim();
    if (!name || name.length > 80) throw new ApiException(400, "invalid_location", "Location name is required and must be at most 80 characters.");
    const location = await savePickupLocation({ id: body.id?.trim() || newId("loc"), name, active: body.active !== false });
    await recordAudit({ actorId: actor.userId, actorRole: "admin", action: "admin.location_upsert", resourceType: "pickup_location", resourceId: location.id, metadata: { name, active: location.active } });
    return ok({ location });
  } catch (error) { return fromError(error); }
}
