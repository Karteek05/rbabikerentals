"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listVehiclesForAdmin = listVehiclesForAdmin;
exports.createVehicleByAdmin = createVehicleByAdmin;
exports.updateVehicleByAdmin = updateVehicleByAdmin;
exports.deleteVehicleByAdmin = deleteVehicleByAdmin;
const service_1 = require("../../lib/audit/service");
const repository_1 = require("../../lib/data/repository");
const errors_1 = require("../../lib/utils/errors");
const ids_1 = require("../../lib/utils/ids");
function assertAdmin(actor) {
    if (actor.role !== "admin") {
        throw new errors_1.ApiException(403, "forbidden", "Only admin can manage vehicles.");
    }
}
function assertNonNegativeNumber(value, field) {
    if (!Number.isFinite(value) || value < 0) {
        throw new errors_1.ApiException(400, "invalid_input", `${field} must be a non-negative number.`);
    }
}
function sanitizeImageUrls(imageUrls) {
    if (!imageUrls)
        return [];
    const cleaned = imageUrls
        .map((item) => item.trim())
        .filter((item) => item.length > 0);
    return Array.from(new Set(cleaned)).slice(0, 12);
}
function assertCategory(value) {
    if (!["scooter", "bike", "ev_bike"].includes(value)) {
        throw new errors_1.ApiException(400, "invalid_category", "category must be scooter, bike, or ev_bike.");
    }
}
async function assertPartnerOwner(ownerId) {
    const owner = await (0, repository_1.getUserOrThrow)(ownerId);
    if (owner.role !== "partner_investor") {
        throw new errors_1.ApiException(400, "invalid_owner", "owner_id must belong to a partner/investor account.");
    }
}
async function listVehiclesForAdmin(options) {
    const vehicles = await (0, repository_1.listVehicles)();
    const filtered = options?.includeInactive
        ? vehicles
        : vehicles.filter((vehicle) => vehicle.is_active);
    return filtered.sort((a, b) => a.id.localeCompare(b.id));
}
async function createVehicleByAdmin(input, actor) {
    assertAdmin(actor);
    (0, repository_1.assertBengaluruCity)(input.city ?? "bengaluru");
    await assertPartnerOwner(input.owner_id);
    assertCategory(input.category);
    if (!input.brand.trim() || !input.model.trim()) {
        throw new errors_1.ApiException(400, "invalid_input", "brand and model are required.");
    }
    assertNonNegativeNumber(input.deposit_amount, "deposit_amount");
    assertNonNegativeNumber(input.rate_per_hour, "rate_per_hour");
    assertNonNegativeNumber(input.rate_per_day, "rate_per_day");
    assertNonNegativeNumber(input.rate_per_week, "rate_per_week");
    assertNonNegativeNumber(input.rate_per_month, "rate_per_month");
    const vehicle = {
        id: (0, ids_1.newId)("veh"),
        owner_id: input.owner_id,
        city: "bengaluru",
        category: input.category,
        brand: input.brand.trim(),
        model: input.model.trim(),
        image_urls: sanitizeImageUrls(input.image_urls),
        is_active: input.is_active ?? true,
        deposit_amount: Math.round(input.deposit_amount),
        rate_per_hour: Math.round(input.rate_per_hour),
        rate_per_day: Math.round(input.rate_per_day),
        rate_per_week: Math.round(input.rate_per_week),
        rate_per_month: Math.round(input.rate_per_month)
    };
    const created = await (0, repository_1.upsertVehicle)(vehicle);
    await (0, service_1.recordAudit)({
        actorId: actor.userId,
        actorRole: actor.role,
        action: "admin.vehicle_create",
        resourceType: "vehicle",
        resourceId: created.id,
        metadata: { owner_id: created.owner_id, brand: created.brand, model: created.model }
    });
    return created;
}
async function updateVehicleByAdmin(vehicleId, input, actor) {
    assertAdmin(actor);
    const current = (await (0, repository_1.listVehicles)()).find((item) => item.id === vehicleId);
    if (!current) {
        throw new errors_1.ApiException(404, "vehicle_not_found", "Vehicle does not exist.");
    }
    if (input.city)
        (0, repository_1.assertBengaluruCity)(input.city);
    if (input.owner_id)
        await assertPartnerOwner(input.owner_id);
    if (input.category)
        assertCategory(input.category);
    if (input.deposit_amount !== undefined) {
        assertNonNegativeNumber(input.deposit_amount, "deposit_amount");
    }
    if (input.rate_per_hour !== undefined) {
        assertNonNegativeNumber(input.rate_per_hour, "rate_per_hour");
    }
    if (input.rate_per_day !== undefined) {
        assertNonNegativeNumber(input.rate_per_day, "rate_per_day");
    }
    if (input.rate_per_week !== undefined) {
        assertNonNegativeNumber(input.rate_per_week, "rate_per_week");
    }
    if (input.rate_per_month !== undefined) {
        assertNonNegativeNumber(input.rate_per_month, "rate_per_month");
    }
    const updated = {
        ...current,
        owner_id: input.owner_id ?? current.owner_id,
        category: input.category ?? current.category,
        brand: input.brand?.trim() || current.brand,
        model: input.model?.trim() || current.model,
        image_urls: input.image_urls !== undefined
            ? sanitizeImageUrls(input.image_urls)
            : current.image_urls ?? [],
        is_active: input.is_active ?? current.is_active,
        deposit_amount: input.deposit_amount !== undefined
            ? Math.round(input.deposit_amount)
            : current.deposit_amount,
        rate_per_hour: input.rate_per_hour !== undefined ? Math.round(input.rate_per_hour) : current.rate_per_hour,
        rate_per_day: input.rate_per_day !== undefined ? Math.round(input.rate_per_day) : current.rate_per_day,
        rate_per_week: input.rate_per_week !== undefined ? Math.round(input.rate_per_week) : current.rate_per_week,
        rate_per_month: input.rate_per_month !== undefined
            ? Math.round(input.rate_per_month)
            : current.rate_per_month
    };
    const saved = await (0, repository_1.upsertVehicle)(updated);
    await (0, service_1.recordAudit)({
        actorId: actor.userId,
        actorRole: actor.role,
        action: "admin.vehicle_update",
        resourceType: "vehicle",
        resourceId: saved.id,
        metadata: {
            updated_fields: Object.keys(input),
            is_active: saved.is_active
        }
    });
    return saved;
}
async function deleteVehicleByAdmin(vehicleId, actor) {
    assertAdmin(actor);
    const bookings = await (0, repository_1.listBookings)({ vehicleId });
    if (bookings.length > 0) {
        throw new errors_1.ApiException(409, "vehicle_has_bookings", "Vehicle has bookings history. Deactivate it instead of deleting.");
    }
    const deleted = await (0, repository_1.deleteVehicleById)(vehicleId);
    if (!deleted) {
        throw new errors_1.ApiException(404, "vehicle_not_found", "Vehicle does not exist.");
    }
    await (0, service_1.recordAudit)({
        actorId: actor.userId,
        actorRole: actor.role,
        action: "admin.vehicle_delete",
        resourceType: "vehicle",
        resourceId: deleted.id
    });
    return deleted;
}
