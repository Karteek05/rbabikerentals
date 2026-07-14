import { requireApprovedPartner } from "@/lib/auth/partner-access";
import { getPartnerBookings, type PartnerBookingTab } from "@/lib/partner/service";
import { ok, fromError } from "@/lib/utils/http";

const TABS = new Set<PartnerBookingTab>([
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
    const statusParam = url.searchParams.get("status") ?? "all";
    const status = TABS.has(statusParam as PartnerBookingTab)
      ? (statusParam as PartnerBookingTab)
      : "all";
    const from = url.searchParams.get("from") ?? undefined;
    const to = url.searchParams.get("to") ?? undefined;

    const result = await getPartnerBookings(actor.userId, { status, from, to });
    return ok(result);
  } catch (error) {
    return fromError(error);
  }
}
