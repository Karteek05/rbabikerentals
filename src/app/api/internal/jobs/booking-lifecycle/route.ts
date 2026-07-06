import { runBookingLifecycleJob } from "@/lib/bookings/lifecycle";
import { ApiException } from "@/lib/utils/errors";
import { ok, fromError } from "@/lib/utils/http";

export async function POST(request: Request) {
  try {
    const token = request.headers.get("x-job-secret");
    if (!token || token !== process.env.JOB_SECRET) {
      throw new ApiException(401, "unauthorized_job", "Invalid job secret.");
    }
    const result = await runBookingLifecycleJob();
    return ok(result);
  } catch (error) {
    return fromError(error);
  }
}
