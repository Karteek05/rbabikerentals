import path from "path";
import { readFile } from "fs/promises";
import { requireActor } from "@/lib/auth/context";
import { getVehicleDocumentOrThrow, getVehicleOrThrow } from "@/lib/data/repository";
import { assertVehicleDocumentAccess, LOCAL_DOC_PREFIX } from "@/lib/vehicles/documents";
import { getSupabaseServiceClient, isSupabaseConfigured } from "@/lib/db/supabase-client";
import { ApiException } from "@/lib/utils/errors";
import { fromError } from "@/lib/utils/http";

export const runtime = "nodejs";

function contentTypeForFileName(fileName: string) {
  const ext = path.extname(fileName).toLowerCase();
  if (ext === ".pdf") return "application/pdf";
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  return "application/octet-stream";
}

function resolvePathUnderRoot(root: string, relativePath: string) {
  const absRoot = path.resolve(root);
  const absPath = path.resolve(absRoot, relativePath);
  if (absPath !== absRoot && !absPath.startsWith(`${absRoot}${path.sep}`)) {
    throw new ApiException(403, "forbidden", "Invalid document path.");
  }
  return absPath;
}

async function readLocalDocument(absPath: string, inlineOnly = false) {
  const buffer = await readFile(absPath);
  const fileName = path.basename(absPath);
  return documentResponse(buffer, fileName, inlineOnly);
}

function documentResponse(buffer: ArrayBuffer | Buffer, fileName: string, inlineOnly = false) {
  const headers: Record<string, string> = {
    "content-type": contentTypeForFileName(fileName),
    "cache-control": "private, no-store",
    "x-content-type-options": "nosniff"
  };
  if (inlineOnly) {
    headers["content-disposition"] = "inline";
  } else {
    headers["content-disposition"] = `inline; filename="${fileName}"`;
  }
  return new Response(buffer, { headers });
}

async function readRemoteDocument(url: string, inlineOnly = false) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new ApiException(404, "document_not_found", "Document file is unavailable.");
  }
  const fileName = new URL(url).pathname.split("/").pop() ?? "document.pdf";
  const buffer = await response.arrayBuffer();
  const contentType = response.headers.get("content-type") ?? contentTypeForFileName(fileName);
  const headers: Record<string, string> = {
    "content-type": contentType,
    "cache-control": "private, no-store",
    "x-content-type-options": "nosniff",
    "content-disposition": inlineOnly ? "inline" : `inline; filename="${fileName}"`
  };
  return new Response(buffer, { headers });
}

async function readStoredDocument(relativePath: string, inlineOnly = false) {
  const fileName = path.basename(relativePath);

  if (isSupabaseConfigured()) {
    const bucket = process.env.SUPABASE_VEHICLE_DOC_BUCKET ?? "vehicle-documents";
    const supabase = getSupabaseServiceClient();
    const { data, error } = await supabase.storage.from(bucket).download(relativePath);
    if (!error && data) {
      const buffer = Buffer.from(await data.arrayBuffer());
      return documentResponse(buffer, fileName, inlineOnly);
    }
  }

  const storageRoot = path.join(process.cwd(), ".data", "vehicle-documents");
  const absPath = resolvePathUnderRoot(storageRoot, relativePath);
  try {
    return await readLocalDocument(absPath, inlineOnly);
  } catch {
    throw new ApiException(404, "document_not_found", "Document file is unavailable on this server.");
  }
}

function assertCustomerInlineFetch(request: Request) {
  if (request.headers.get("x-rba-document-viewer") === "1") {
    return;
  }
  throw new ApiException(
    403,
    "view_only",
    "Open this document from the in-app viewer instead of downloading it directly."
  );
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string; docId: string }> }
) {
  try {
    const actor = await requireActor(request, ["customer", "partner_investor", "admin"]);
    const { id, docId } = await context.params;
    const vehicle = await getVehicleOrThrow(id);
    await assertVehicleDocumentAccess(actor, vehicle);

    const doc = await getVehicleDocumentOrThrow(id, docId);
    const inlineOnly = actor.role === "customer";
    if (inlineOnly) {
      assertCustomerInlineFetch(request);
    }
    if (doc.file_url.startsWith("http://") || doc.file_url.startsWith("https://")) {
      return readRemoteDocument(doc.file_url, inlineOnly);
    }

    if (!doc.file_url.startsWith(LOCAL_DOC_PREFIX)) {
      if (doc.file_url.startsWith("/uploads/")) {
        const legacyRoot = path.join(process.cwd(), "public", "uploads");
        const legacyPath = resolvePathUnderRoot(legacyRoot, doc.file_url.slice("/uploads/".length));
        return readLocalDocument(legacyPath, inlineOnly);
      }
      throw new ApiException(404, "document_not_found", "Document file is unavailable.");
    }

    const relativePath = doc.file_url.slice(LOCAL_DOC_PREFIX.length);
    return readStoredDocument(relativePath, inlineOnly);
  } catch (error) {
    return fromError(error);
  }
}
