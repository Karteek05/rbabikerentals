import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { requireActor } from "@/lib/auth/context";
import { readValidatedUpload } from "@/lib/uploads/validation";
import {
  findVehicleDocumentByType,
  getVehicleDocumentOrThrow,
  getVehicleOrThrow,
  upsertVehicleDocument,
  updateVehicleDocument,
  deleteVehicleDocument,
  queueVehicleDocumentCleanup,
  removeVehicleDocumentCleanup
} from "@/lib/data/repository";
import {
	getSupabaseServiceClient,
	isSupabaseConfigured,
} from "@/lib/db/supabase-client";
import {
	LOCAL_DOC_PREFIX,
	parseOptionalExpiresAt,
} from "@/lib/vehicles/documents";
import { ApiException } from "@/lib/utils/errors";
import { fromError, ok, parseJson } from "@/lib/utils/http";
import { newId } from "@/lib/utils/ids";
import { recordAudit } from "@/lib/audit/service";
import type { VehicleDocument } from "@/lib/types/domain";
import { assertVehicleDocumentStorageAvailable, removeStoredVehicleDocument } from "@/lib/vehicles/storage";

export const runtime = "nodejs";

function sanitizeFileName(name: string) {
	const normalized = name.replace(/[^a-zA-Z0-9._-]/g, "_");
	return normalized.length ? normalized : "document.pdf";
}

function localDocumentPath(vehicleId: string, stampedName: string) {
	return path.join(
		process.cwd(),
		".data",
		"vehicle-documents",
		vehicleId,
		stampedName,
	);
}

async function uploadFile(
	vehicleId: string,
	docType: string,
	file: File,
): Promise<string> {
	assertVehicleDocumentStorageAvailable();
	const { buffer, fileName } = await readValidatedUpload(file, {
		kind: "document",
		maxBytes: 15 * 1024 * 1024,
	});
	const safeName = sanitizeFileName(fileName);
	const stampedName = `${Date.now()}-${newId("doc")}-${docType}-${safeName}`;

	if (isSupabaseConfigured()) {
		const bucket = process.env.SUPABASE_VEHICLE_DOC_BUCKET?.trim() || "vehicle-documents";
		const objectPath = `${vehicleId}/${stampedName}`;
		const supabase = getSupabaseServiceClient();
		const { error } = await supabase.storage
			.from(bucket)
			.upload(objectPath, buffer, { contentType: file.type, upsert: false });
		if (error) throw new ApiException(500, "storage_error", error.message);
		return `${LOCAL_DOC_PREFIX}${objectPath}`;
	}

	const absPath = localDocumentPath(vehicleId, stampedName);
	await mkdir(path.dirname(absPath), { recursive: true });
	await writeFile(absPath, buffer, { flag: "wx" });
	return `${LOCAL_DOC_PREFIX}${vehicleId}/${stampedName}`;
}


export async function POST(
	request: Request,
	context: { params: Promise<{ id: string }> },
) {
	let uploadedFileUrl: string | null = null;
	try {
		const actorRaw = await requireActor(request, ["admin"]);
		const actor = { userId: actorRaw.userId, role: "admin" as const };
		const { id } = await context.params;
		await getVehicleOrThrow(id);
		const form = await request.formData();
		const fileEntry = form.get("file");
		const docTypeEntry = form.get("doc_type");

		if (!(fileEntry instanceof File)) {
			throw new ApiException(400, "file_required", "Upload a document file using the 'file' form field.");
		}
		if (typeof docTypeEntry !== "string" || !["rc", "insurance", "invoice"].includes(docTypeEntry)) {
			throw new ApiException(400, "invalid_doc_type", "doc_type must be one of: rc, insurance, invoice.");
		}

		const docType = docTypeEntry as VehicleDocument["doc_type"];
		const existing = await findVehicleDocumentByType(id, docType);
		uploadedFileUrl = await uploadFile(id, docTypeEntry, fileEntry);
		const now = new Date().toISOString();
		const doc: VehicleDocument = {
			id: existing?.id ?? newId("vdoc"),
			vehicle_id: id,
			doc_type: docType,
			file_url: uploadedFileUrl,
			expires_at: parseOptionalExpiresAt(form.get("expires_at")),
			created_at: existing?.created_at ?? now,
			updated_at: now
		};
		if (existing && existing.file_url.startsWith(LOCAL_DOC_PREFIX)) {
			await queueVehicleDocumentCleanup(existing.file_url);
		}
		const savedDoc = await upsertVehicleDocument(doc);
		uploadedFileUrl = null;

		if (existing && existing.file_url !== savedDoc.file_url) {
			try {
				await removeStoredVehicleDocument(existing.file_url);
				await removeVehicleDocumentCleanup(existing.file_url);
			} catch (cleanupError) {
				console.error("Vehicle document replacement cleanup remains queued.", cleanupError);
			}
		}

		await recordAudit({
			actorId: actor.userId,
			actorRole: actor.role,
			action: "admin.vehicle_document_upload",
			resourceType: "vehicle_document",
			resourceId: savedDoc.id,
			metadata: { vehicle_id: id, doc_type: docTypeEntry }
		});
		return ok({ document: savedDoc }, existing ? 200 : 201);
	} catch (error) {
		if (uploadedFileUrl) {
			try {
				await queueVehicleDocumentCleanup(uploadedFileUrl);
			} catch (cleanupError) {
				console.error("Could not queue uncommitted vehicle document cleanup.", cleanupError);
			}
		}
		return fromError(error);
	}
}

export async function PATCH(
	request: Request,
	context: { params: Promise<{ id: string }> }
) {
	try {
		const actor = await requireActor(request, ["admin"]);
		const { id } = await context.params;
		const body = await parseJson<unknown>(request);
		if (!body || typeof body !== "object") {
			throw new ApiException(400, "invalid_document", "Document update must be an object.");
		}
		const docId = "doc_id" in body ? body.doc_id : undefined;
		const expiresAt = "expires_at" in body ? body.expires_at : undefined;
		if (typeof docId !== "string" || !docId.trim()) {
			throw new ApiException(400, "document_id_required", "doc_id is required.");
		}
		if (expiresAt !== null && typeof expiresAt !== "string") {
			throw new ApiException(400, "invalid_expires_at", "expires_at must be a date or null.");
		}
		const saved = await updateVehicleDocument(id, docId, {
			expires_at: parseOptionalExpiresAt(typeof expiresAt === "string" ? expiresAt : null),
			updated_at: new Date().toISOString()
		});
		await recordAudit({
			actorId: actor.userId,
			actorRole: "admin",
			action: "admin.vehicle_document_update",
			resourceType: "vehicle_document",
			resourceId: saved.id,
			metadata: { vehicle_id: id, expires_at: saved.expires_at }
		});
		return ok({ document: saved });
	} catch (error) {
		return fromError(error);
	}
}

export async function DELETE(
	request: Request,
	context: { params: Promise<{ id: string }> }
) {
	try {
		const actor = await requireActor(request, ["admin"]);
		const { id } = await context.params;
		const body = await parseJson<unknown>(request);
		if (!body || typeof body !== "object") {
			throw new ApiException(400, "invalid_document", "Document deletion must be an object.");
		}
		const docId = "doc_id" in body ? body.doc_id : undefined;
		if (typeof docId !== "string" || !docId.trim()) {
			throw new ApiException(400, "document_id_required", "doc_id is required.");
		}
		const existing = await getVehicleDocumentOrThrow(id, docId);
		if (existing.file_url.startsWith(LOCAL_DOC_PREFIX)) {
			await queueVehicleDocumentCleanup(existing.file_url);
		}
		await deleteVehicleDocument(id, docId);
		try {
			await removeStoredVehicleDocument(existing.file_url);
			await removeVehicleDocumentCleanup(existing.file_url);
		} catch (cleanupError) {
			console.error("Vehicle document deletion cleanup remains queued.", cleanupError);
		}
		await recordAudit({
			actorId: actor.userId,
			actorRole: "admin",
			action: "admin.vehicle_document_delete",
			resourceType: "vehicle_document",
			resourceId: existing.id,
			metadata: { vehicle_id: id, doc_type: existing.doc_type }
		});
		return ok({ document_id: existing.id });
	} catch (error) {
		return fromError(error);
	}
}

