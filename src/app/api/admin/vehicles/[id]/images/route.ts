import path from "path";
import { mkdir, writeFile } from "fs/promises";
import { requireActor } from "@/lib/auth/context";
import { listVehiclesForAdmin, updateVehicleByAdmin } from "@/lib/admin/vehicle-service";
import { getSupabaseServiceClient, isSupabaseConfigured } from "@/lib/db/supabase-client";
import type { AdminVehicleImageRequest } from "@/lib/types/contracts";
import { ApiException } from "@/lib/utils/errors";
import { fromError, ok, parseJson } from "@/lib/utils/http";

export const runtime = "nodejs";

function sanitizeFileName(name: string) {
  const normalized = name.replace(/[^a-zA-Z0-9._-]/g, "_");
  return normalized.length ? normalized : "vehicle-image.jpg";
}

async function appendImage(
  vehicleId: string,
  imageUrl: string,
  actor: { userId: string; role: "admin" }
) {
  const vehicles = await listVehiclesForAdmin({ includeInactive: true });
  const vehicle = vehicles.find((item) => item.id === vehicleId);
  if (!vehicle) {
    throw new ApiException(404, "vehicle_not_found", "Vehicle does not exist.");
  }
  const nextImages = [...(vehicle.image_urls ?? []), imageUrl];
  return updateVehicleByAdmin(vehicleId, { image_urls: nextImages }, actor);
}

async function uploadFile(vehicleId: string, file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new ApiException(400, "invalid_file_type", "Only image uploads are allowed.");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.length > 8 * 1024 * 1024) {
    throw new ApiException(400, "file_too_large", "Image file must be 8MB or smaller.");
  }

  const safeName = sanitizeFileName(file.name);
  const stampedName = `${Date.now()}-${safeName}`;

  if (isSupabaseConfigured()) {
    const bucket = process.env.SUPABASE_VEHICLE_IMAGE_BUCKET ?? "vehicle-images";
    const objectPath = `${vehicleId}/${stampedName}`;
    const supabase = getSupabaseServiceClient();
    const { error } = await supabase.storage
      .from(bucket)
      .upload(objectPath, buffer, { contentType: file.type, upsert: false });
    if (error) {
      throw new ApiException(500, "storage_error", error.message);
    }
    const { data } = supabase.storage.from(bucket).getPublicUrl(objectPath);
    if (!data?.publicUrl) {
      throw new ApiException(
        500,
        "storage_error",
        "Image uploaded but public URL could not be generated."
      );
    }
    return data.publicUrl;
  }

  const relativeDir = path.join("uploads", "vehicles", vehicleId);
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
    const contentType = request.headers.get("content-type") ?? "";

    if (contentType.includes("application/json")) {
      const body = await parseJson<AdminVehicleImageRequest>(request);
      if (!body.image_url || !body.image_url.trim()) {
        throw new ApiException(400, "invalid_image_url", "image_url is required.");
      }
      const vehicle = await appendImage(id, body.image_url.trim(), actor);
      return ok({ vehicle });
    }

    const form = await request.formData();
    const fileEntry = form.get("file");
    if (!(fileEntry instanceof File)) {
      throw new ApiException(
        400,
        "file_required",
        "Upload an image file using the 'file' form field."
      );
    }

    const imageUrl = await uploadFile(id, fileEntry);
    const vehicle = await appendImage(id, imageUrl, actor);
    return ok({ vehicle, image_url: imageUrl }, 201);
  } catch (error) {
    return fromError(error);
  }
}
