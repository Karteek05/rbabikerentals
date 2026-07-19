import path from "path";
import { mkdir, writeFile } from "fs/promises";
import { requireActor } from "@/lib/auth/context";
import {
  findVehicleDocumentByType,
  getVehicleOrThrow,
  upsertVehicleDocument
} from "@/lib/data/repository";
import { getSupabaseServiceClient, isSupabaseConfigured } from "@/lib/db/supabase-client";
import { LOCAL_DOC_PREFIX, parseOptionalExpiresAt } from "@/lib/vehicles/documents";
import { ApiException } from "@/lib/utils/errors";
import { fromError, ok } from "@/lib/utils/http";
import { newId } from "@/lib/utils/ids";
import { recordAudit } from "@/lib/audit/service";
import type { VehicleDocument } from "@/lib/types/domain";

export const runtime = "nodejs";

function sanitizeFileName(name: string) {
  const normalized = name.replace(/[^a-zA-Z0-9._-]/g, "_");
  return normalized.length ? normalized : "document.pdf";
}

function localDocumentPath(vehicleId: string, stampedName: string) {
  return path.join(process.cwd(), ".data", "vehicle-documents", vehicleId, stampedName);
}

async function uploadFile(vehicleId: string, docType: string, file: File): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.length > 15 * 1024 * 1024) {
    throw new ApiException(400, "file_too_large", "Document file must be 15MB or smaller.");
  }

  const safeName = sanitizeFileName(file.name);
  const stampedName = `${Date.now()}-${docType}-${safeName}`;

  if (isSupabaseConfigured()) {
    const bucket = process.env.SUPABASE_VEHICLE_DOC_BUCKET ?? "vehicle-documents";
    const objectPath = `${vehicleId}/${stampedName}`;
    const supabase = getSupabaseServiceClient();
    const { error } = await supabase.storage
      .from(bucket)
      .upload(objectPath, buffer, { contentType: file.type, upsert: false });

    if (error) {
      throw new ApiException(500, "storage_error", error.message);
    }

    return `${LOCAL_DOC_PREFIX}${objectPath}`;
  }

  const absPath = localDocumentPath(vehicleId, stampedName);
  await mkdir(path.dirname(absPath), { recursive: true });
  await writeFile(absPath, buffer);
  return `${LOCAL_DOC_PREFIX}${vehicleId}/${stampedName}`;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const actorRaw = await requireActor(request, ["admin"]);
    const actor = { userId: actorRaw.userId, role: "admin" as const };
    const { id } = await context.params;

    await getVehicleOrThrow(id);

    const form = await request.formData();
    const fileEntry = form.get("file");
    const docTypeEntry = form.get("doc_type");

    if (!(fileEntry instanceof File)) {
      throw new ApiException(
        400,
        "file_required",
        "Upload a document file using the 'file' form field."
      );
    }

    if (typeof docTypeEntry !== "string" || !["rc", "insurance", "invoice"].includes(docTypeEntry)) {
      throw new ApiException(
        400,
        "invalid_doc_type",
        "doc_type must be one of: rc, insurance, invoice."
      );
    }

    const docType = docTypeEntry as VehicleDocument["doc_type"];
    const existing = await findVehicleDocumentByType(id, docType);
    const fileUrl = await uploadFile(id, docTypeEntry, fileEntry);
    const now = new Date().toISOString();

    const doc: VehicleDocument = {
      id: existing?.id ?? newId("vdoc"),
      vehicle_id: id,
      doc_type: docType,
      file_url: fileUrl,
      expires_at: parseOptionalExpiresAt(form.get("expires_at")),
      created_at: existing?.created_at ?? now,
      updated_at: now
    };

    const savedDoc = await upsertVehicleDocument(doc);

    await recordAudit({
      actorId: actor.userId,
      actorRole: actor.role,
      action: "admin.vehicle_document_upload",
      resourceType: "vehicle_document",
      resourceId: savedDoc.id,
      metadata: { vehicle_id: id, doc_type: docTypeEntry }
    });

    return ok({ document: savedDoc }, 201);
  } catch (error) {
    return fromError(error);
  }
}
