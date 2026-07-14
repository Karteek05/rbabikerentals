import { requireApprovedPartner } from "@/lib/auth/partner-access";
import { getPartnerDashboardSummary, type PartnerBookingTab } from "@/lib/partner/service";
import { ok, fromError } from "@/lib/utils/http";
const BOOKING_TABS = new Set<PartnerBookingTab>([
  "all",
  "upcoming",
  "ongoing",
  "completed",
  "cancelled"
]);
export async function GET(request: Request) {
  try {
    const actor = await requireApprovedPartner(request);
    const url = new URL(request.url);
    const from = url.searchParams.get("from") ?? undefined;
    const to = url.searchParams.get("to") ?? undefined;
    const statusParam = url.searchParams.get("status") ?? "all";
    const status = BOOKING_TABS.has(statusParam as PartnerBookingTab)
      ? (statusParam as PartnerBookingTab)
      : "all";
    const result = await getPartnerDashboardSummary(actor.userId, { from, to, status });
    return ok(result);
  } catch (error) {
    return fromError(error);
  }
}
