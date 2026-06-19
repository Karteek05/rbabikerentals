"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listTrackingForActor = listTrackingForActor;
exports.upsertTrackingLocation = upsertTrackingLocation;
const repository_1 = require("../../lib/data/repository");
const errors_1 = require("../../lib/utils/errors");
function assertCoordinates(latitude, longitude) {
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
        throw new errors_1.ApiException(400, "invalid_latitude", "Latitude must be between -90 and 90.");
    }
    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
        throw new errors_1.ApiException(400, "invalid_longitude", "Longitude must be between -180 and 180.");
    }
}
async function listTrackingForActor(actor) {
    const user = await (0, repository_1.getUserOrThrow)(actor.userId);
    if (user.role !== actor.role && actor.role !== "admin") {
        throw new errors_1.ApiException(403, "forbidden", "Actor role mismatch.");
    }
    const items = actor.role === "admin"
        ? await (0, repository_1.listVehicleLiveLocations)()
        : await (0, repository_1.listVehicleLiveLocations)({ ownerId: actor.userId });
    const sorted = [...items].sort((a, b) => a.vehicle_id.localeCompare(b.vehicle_id));
    return { items: sorted, as_of: new Date().toISOString() };
}
async function upsertTrackingLocation(input) {
    assertCoordinates(input.latitude, input.longitude);
    if (input.speed_kmph !== undefined && input.speed_kmph !== null && input.speed_kmph < 0) {
        throw new errors_1.ApiException(400, "invalid_speed", "Speed cannot be negative.");
    }
    if (input.heading_deg !== undefined &&
        input.heading_deg !== null &&
        (input.heading_deg < 0 || input.heading_deg >= 360)) {
        throw new errors_1.ApiException(400, "invalid_heading", "Heading must be between 0 and 359.");
    }
    await (0, repository_1.getVehicleOrThrow)(input.vehicle_id);
    const payload = {
        vehicle_id: input.vehicle_id,
        latitude: Number(input.latitude.toFixed(6)),
        longitude: Number(input.longitude.toFixed(6)),
        speed_kmph: input.speed_kmph ?? null,
        heading_deg: input.heading_deg ?? null,
        source: input.source?.trim() || "internal_ping",
        updated_at: new Date().toISOString()
    };
    return (0, repository_1.upsertVehicleLiveLocation)(payload);
}
