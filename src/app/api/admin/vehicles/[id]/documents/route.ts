import path from "path";
import { mkdir, writeFile } from "fs/promises";
import { requireActor } from "@/lib/auth/context";
import { getVehicleOrThrow, upsertVehicleDocument } from "@/lib/data/repository";
import { getSupabaseServiceClient, isSupabaseConfigured } from "@/lib/db/supabase-client";
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
    
    // Ensure bucket exists or falls back if not explicitly created
    const { error } = await supabase.storage
      .from(bucket)
      .upload(objectPath, buffer, { contentType: file.type, upsert: false });
      
    if (error) {
      throw new ApiException(500, "storage_error", error.message);
    }
    
    // Using a private bucket might require signed URLs, but for now we generate a URL
    // If it's a private bucket, getPublicUrl might not work for unauthenticated users,
    // which aligns with our requirement that only users with a booking can view it.
    // However, for simplicity if using public bucket:
    const { data } = supabase.storage.from(bucket).getPublicUrl(objectPath);
    if (!data?.publicUrl) {
      throw new ApiException(
        500,
        "storage_error",
        "Document uploaded but URL could not be generated."
      );
    }
    return data.publicUrl;
  }

  // Local fallback (using public/uploads/documents/ for obfuscation/accessibility)
  const relativeDir = path.join("uploads", "documents", vehicleId);
  const absDir = path.join(process.cwd(), "public", relativeDir);
  await mkdir(absDir, { recursive: true });
  await writeFile(path.join(absDir, stampedName), buffer);
  return `/${path.join(relativeDir, stampedName).replace(/\\/g, "/")}`;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const actorRaw = await requireActor(request, ["admin"]);
    const actor = { userId: actorRaw.userId, role: "admin" as const };
    const { id } = await context.params;

    // Verify vehicle exists
    await getVehicleOrThrow(id);

    const form = await request.formData();
    const fileEntry = form.get("file");
    const docTypeEntry = form.get("doc_type");
    const expiresAtEntry = form.get("expires_at");

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

    const fileUrl = await uploadFile(id, docTypeEntry, fileEntry);

    const doc: VehicleDocument = {
      id: newId("vdoc"),
      vehicle_id: id,
      doc_type: docTypeEntry as any,
      file_url: fileUrl,
      expires_at: typeof expiresAtEntry === "string" && expiresAtEntry ? new Date(expiresAtEntry).toISOString() : null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
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
