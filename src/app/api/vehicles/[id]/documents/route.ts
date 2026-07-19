import { requireActor } from "@/lib/auth/context";
import { getVehicleOrThrow, listVehicleDocuments } from "@/lib/data/repository";
import {
  assertVehicleDocumentAccess,
  toClientDocument,
  toVehicleDocReference
} from "@/lib/vehicles/documents";
import { fromError, ok } from "@/lib/utils/http";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireActor(request, ["customer", "partner_investor", "admin"]);
    const { id } = await context.params;
    const vehicle = await getVehicleOrThrow(id);
    await assertVehicleDocumentAccess(actor, vehicle);

    const viewOnly = actor.role === "customer";
    const documents = (await listVehicleDocuments(id)).map((doc) =>
      toClientDocument(id, doc, { viewOnly })
    );
    return ok({ documents, vehicle: toVehicleDocReference(vehicle) });
  } catch (error) {
    return fromError(error);
  }
}
