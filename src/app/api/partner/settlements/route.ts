import { requireActor } from "@/lib/auth/context";
import { listPartnerSettlements } from "@/lib/data/repository";
import { fromError, ok } from "@/lib/utils/http";

export async function GET(request: Request) {
  try {
    const actor = await requireActor(request, ["partner_investor"]);
    const items = await listPartnerSettlements(actor.userId);
    return ok({ items: items.map(({ id, period_start, period_end, amount_paise, status, reference, paid_at, notes, created_at }) => ({ id, period_start, period_end, amount_paise, status, reference, paid_at, notes, created_at })) });
  } catch (error) { return fromError(error); }
}
