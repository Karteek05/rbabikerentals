import { requireActor } from "@/lib/auth/context";
import { reportDamageIncident } from "@/lib/bookings/service";
import type { ReportDamageRequest } from "@/lib/types/contracts";
import { parseJson, ok, fromError } from "@/lib/utils/http";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireActor(request, ["customer", "admin"]);
    const { id } = await context.params;
    const body = await parseJson<ReportDamageRequest>(request);
    const incident = await reportDamageIncident({
      bookingId: id,
      actorId: actor.userId,
      actorRole: actor.role,
      description: body.description,
      photoUrls: body.photo_urls
    });
    return ok({ incident }, 201);
  } catch (error) {
    return fromError(error);
  }
}

