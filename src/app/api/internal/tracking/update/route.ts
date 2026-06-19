import { upsertTrackingLocation } from "@/lib/tracking/service";
import type { UpdateVehicleTrackingRequest } from "@/lib/types/contracts";
import { ApiException } from "@/lib/utils/errors";
import { fromError, ok, parseJson } from "@/lib/utils/http";

export async function POST(request: Request) {
  try {
    const token = request.headers.get("x-job-secret");
    if (!token || token !== process.env.JOB_SECRET) {
      throw new ApiException(401, "unauthorized_job", "Invalid job secret.");
    }

    const body = await parseJson<UpdateVehicleTrackingRequest>(request);
    const updated = await upsertTrackingLocation(body);
    return ok({ location: updated });
  } catch (error) {
    return fromError(error);
  }
}
