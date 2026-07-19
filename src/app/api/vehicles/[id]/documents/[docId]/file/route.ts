import path from "path";
import { readFile } from "fs/promises";
import { requireActor } from "@/lib/auth/context";
import { getVehicleDocumentOrThrow, getVehicleOrThrow } from "@/lib/data/repository";
import { assertVehicleDocumentAccess, LOCAL_DOC_PREFIX } from "@/lib/vehicles/documents";
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

    const storageRoot = path.join(process.cwd(), ".data", "vehicle-documents");
    const relativePath = doc.file_url.slice(LOCAL_DOC_PREFIX.length);
    const absPath = resolvePathUnderRoot(storageRoot, relativePath);
    return readLocalDocument(absPath, inlineOnly);
  } catch (error) {
    return fromError(error);
  }
}
