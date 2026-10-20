import { requireActor } from "@/lib/auth/context";
import { listOpenDamageIncidents, updateDamageIncident } from "@/lib/data/repository";
import { recordAudit } from "@/lib/audit/service";
import { ApiException } from "@/lib/utils/errors";
import { fromError, ok, parseJson } from "@/lib/utils/http";

export async function GET(request: Request) {
  try { await requireActor(request, ["admin"]); return ok({ items: await listOpenDamageIncidents() }); }
  catch (error) { return fromError(error); }
}

export async function PATCH(request: Request) {
  try {
    const actor = await requireActor(request, ["admin"]);
    const body = await parseJson<{ id?: string; status?: string; admin_notes?: string }>(request);
    if (!body.id || !["open", "investigating", "resolved", "dismissed"].includes(body.status ?? "")) throw new ApiException(400, "invalid_incident_update", "Select a valid incident status.");
    const incident = await updateDamageIncident(body.id, { status: body.status as "open" | "investigating" | "resolved" | "dismissed", admin_notes: body.admin_notes?.trim() || null, reviewed_by: actor.userId, reviewed_at: new Date().toISOString() });
    await recordAudit({ actorId: actor.userId, actorRole: "admin", action: "admin.incident_triage", resourceType: "damage_incident", resourceId: incident.id, metadata: { status: incident.status, admin_notes: incident.admin_notes } });
    return ok({ incident });
  } catch (error) { return fromError(error); }
}
