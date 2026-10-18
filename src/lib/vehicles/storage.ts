import { unlink } from "node:fs/promises";
import path from "node:path";
import { getSupabaseServiceClient, isSupabaseConfigured } from "@/lib/db/supabase-client";
import { ApiException } from "@/lib/utils/errors";
import { LOCAL_DOC_PREFIX } from "@/lib/vehicles/documents";
import { isProductionRuntime } from "@/lib/utils/app-url";


export function assertVehicleDocumentStorageAvailable() {
  if (!isSupabaseConfigured() && isProductionRuntime()) {
    throw new ApiException(
      503,
      "vehicle_document_storage_unavailable",
      "Persistent vehicle document storage is not configured."
    );
  }
}


function isMissingFileError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

export async function removeStoredVehicleDocument(fileUrl: string) {
  if (!fileUrl.startsWith(LOCAL_DOC_PREFIX)) return;
  assertVehicleDocumentStorageAvailable();
  const relativePath = fileUrl.slice(LOCAL_DOC_PREFIX.length);
  const parts = relativePath.split(/[\\/]/);
  if (!relativePath || parts.some((part) => !part || part === "." || part === "..")) {
    throw new ApiException(400, "invalid_document_path", "Stored document path is invalid.");
  }

  if (isSupabaseConfigured()) {
    const bucket = process.env.SUPABASE_VEHICLE_DOC_BUCKET?.trim() || "vehicle-documents";
    const { error } = await getSupabaseServiceClient().storage.from(bucket).remove([relativePath]);
    if (error) throw new ApiException(500, "storage_error", error.message);
    return;
  }

  const root = path.resolve(process.cwd(), ".data", "vehicle-documents");
  const absPath = path.resolve(root, relativePath);
  const relative = path.relative(root, absPath);
  if (
    !relative ||
    relative === ".." ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    throw new ApiException(400, "invalid_document_path", "Stored document path is invalid.");
  }

  try {
    await unlink(absPath);
  } catch (error) {
    if (!isMissingFileError(error)) throw error;
  }
}
