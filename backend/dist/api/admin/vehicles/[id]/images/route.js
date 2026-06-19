"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runtime = void 0;
exports.POST = POST;
const path_1 = __importDefault(require("path"));
const promises_1 = require("fs/promises");
const context_1 = require("../../../../../lib/auth/context");
const vehicle_service_1 = require("../../../../../lib/admin/vehicle-service");
const supabase_client_1 = require("../../../../../lib/db/supabase-client");
const errors_1 = require("../../../../../lib/utils/errors");
const http_1 = require("../../../../../lib/utils/http");
exports.runtime = "nodejs";
function sanitizeFileName(name) {
    const normalized = name.replace(/[^a-zA-Z0-9._-]/g, "_");
    return normalized.length ? normalized : "vehicle-image.jpg";
}
async function appendImage(vehicleId, imageUrl, actor) {
    const vehicles = await (0, vehicle_service_1.listVehiclesForAdmin)({ includeInactive: true });
    const vehicle = vehicles.find((item) => item.id === vehicleId);
    if (!vehicle) {
        throw new errors_1.ApiException(404, "vehicle_not_found", "Vehicle does not exist.");
    }
    const nextImages = [...(vehicle.image_urls ?? []), imageUrl];
    return (0, vehicle_service_1.updateVehicleByAdmin)(vehicleId, { image_urls: nextImages }, actor);
}
async function uploadFile(vehicleId, file) {
    if (!file.type.startsWith("image/")) {
        throw new errors_1.ApiException(400, "invalid_file_type", "Only image uploads are allowed.");
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.length > 8 * 1024 * 1024) {
        throw new errors_1.ApiException(400, "file_too_large", "Image file must be 8MB or smaller.");
    }
    const safeName = sanitizeFileName(file.name);
    const stampedName = `${Date.now()}-${safeName}`;
    if ((0, supabase_client_1.isSupabaseConfigured)()) {
        const bucket = process.env.SUPABASE_VEHICLE_IMAGE_BUCKET ?? "vehicle-images";
        const objectPath = `${vehicleId}/${stampedName}`;
        const supabase = (0, supabase_client_1.getSupabaseServiceClient)();
        const { error } = await supabase.storage
            .from(bucket)
            .upload(objectPath, buffer, { contentType: file.type, upsert: false });
        if (error) {
            throw new errors_1.ApiException(500, "storage_error", error.message);
        }
        const { data } = supabase.storage.from(bucket).getPublicUrl(objectPath);
        if (!data?.publicUrl) {
            throw new errors_1.ApiException(500, "storage_error", "Image uploaded but public URL could not be generated.");
        }
        return data.publicUrl;
    }
    const relativeDir = path_1.default.join("uploads", "vehicles", vehicleId);
    const absDir = path_1.default.join(process.cwd(), "public", relativeDir);
    await (0, promises_1.mkdir)(absDir, { recursive: true });
    await (0, promises_1.writeFile)(path_1.default.join(absDir, stampedName), buffer);
    return `/${path_1.default.join(relativeDir, stampedName).replace(/\\/g, "/")}`;
}
async function POST(request, context) {
    try {
        const actorRaw = await (0, context_1.requireActor)(request, ["admin"]);
        const actor = { userId: actorRaw.userId, role: "admin" };
        const { id } = await context.params;
        const contentType = request.headers.get("content-type") ?? "";
        if (contentType.includes("application/json")) {
            const body = await (0, http_1.parseJson)(request);
            if (!body.image_url || !body.image_url.trim()) {
                throw new errors_1.ApiException(400, "invalid_image_url", "image_url is required.");
            }
            const vehicle = await appendImage(id, body.image_url.trim(), actor);
            return (0, http_1.ok)({ vehicle });
        }
        const form = await request.formData();
        const fileEntry = form.get("file");
        if (!(fileEntry instanceof File)) {
            throw new errors_1.ApiException(400, "file_required", "Upload an image file using the 'file' form field.");
        }
        const imageUrl = await uploadFile(id, fileEntry);
        const vehicle = await appendImage(id, imageUrl, actor);
        return (0, http_1.ok)({ vehicle, image_url: imageUrl }, 201);
    }
    catch (error) {
        return (0, http_1.fromError)(error);
    }
}
