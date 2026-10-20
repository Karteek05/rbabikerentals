import { createPartnerSettlement, getUserOrThrow, listAdminSettlements, listApprovedPartners } from "@/lib/data/repository";
import { requireActor } from "@/lib/auth/context";
import { recordAudit } from "@/lib/audit/service";
import { newId } from "@/lib/utils/ids";
import { ApiException } from "@/lib/utils/errors";
import { fromError, ok, parseJson } from "@/lib/utils/http";

export async function GET(request: Request) {
  try {
    await requireActor(request, ["admin"]);
    const [items, partners] = await Promise.all([listAdminSettlements(), listApprovedPartners()]);
    return ok({ items, partners: partners.map(({ id, name }) => ({ id, name })) });
  } catch (error) { return fromError(error); }
}

export async function POST(request: Request) {
  try {
    const actor = await requireActor(request, ["admin"]);
    const body = await parseJson<{ partner_id?: string; period_start?: string; period_end?: string; amount_paise?: number; reference?: string; paid_at?: string; notes?: string }>(request);
    if (!body.partner_id || !body.period_start || !body.period_end || !Number.isSafeInteger(body.amount_paise) || (body.amount_paise ?? 0) <= 0 || !body.reference?.trim() || !body.paid_at || !/^\d{4}-\d{2}-\d{2}$/.test(body.period_start) || !/^\d{4}-\d{2}-\d{2}$/.test(body.period_end) || body.period_start > body.period_end || !Number.isFinite(new Date(body.paid_at).getTime())) throw new ApiException(400, "invalid_settlement", "Partner, valid period, positive amount in paise, transfer reference and paid date are required.");
    const partner = await getUserOrThrow(body.partner_id);
    if (partner.role !== "partner_investor") throw new ApiException(400, "invalid_partner", "Choose an approved partner account.");
    const entry = await createPartnerSettlement({ id: newId("settlement"), partner_id: partner.id, period_start: body.period_start, period_end: body.period_end, amount_paise: body.amount_paise!, status: "paid", reference: body.reference!.trim(), paid_at: new Date(body.paid_at).toISOString(), notes: body.notes?.trim() || null, created_by: actor.userId });
    await recordAudit({ actorId: actor.userId, actorRole: "admin", action: "admin.settlement_record", resourceType: "partner_settlement", resourceId: entry.id, metadata: { partner_id: entry.partner_id, period_start: entry.period_start, period_end: entry.period_end, amount_paise: entry.amount_paise, reference: entry.reference } });
    return ok({ settlement: entry });
  } catch (error) { return fromError(error); }
}
