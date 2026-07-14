import { requireActor } from "@/lib/auth/context";
import { listPartnerApplicationsForAdmin } from "@/lib/admin/partner-onboarding-service";
import type { PartnerApplicationStatus } from "@/lib/types/domain";
import { ok, fromError } from "@/lib/utils/http";

const STATUSES = new Set<PartnerApplicationStatus | "all">([
  "all",
  "pending",
  "approved",
  "rejected"
]);

export async function GET(request: Request) {
  try {
    await requireActor(request, ["admin"]);
    const url = new URL(request.url);
    const statusParam = url.searchParams.get("status") ?? "pending";
    const status = STATUSES.has(statusParam as PartnerApplicationStatus | "all")
      ? (statusParam as PartnerApplicationStatus | "all")
      : "pending";
    const applications = await listPartnerApplicationsForAdmin({ status });
    return ok({ applications });
  } catch (error) {
    return fromError(error);
  }
}
