"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.blockVehicle = blockVehicle;
const service_1 = require("../../lib/audit/service");
const repository_1 = require("../../lib/data/repository");
const errors_1 = require("../../lib/utils/errors");
const ids_1 = require("../../lib/utils/ids");
async function blockVehicle(vehicleId, input, actor) {
    const vehicle = await (0, repository_1.getVehicleOrThrow)(vehicleId);
    const canManageAsPartner = actor.role === "partner_investor" && vehicle.owner_id === actor.userId;
    if (!canManageAsPartner && actor.role !== "admin") {
        throw new errors_1.ApiException(403, "forbidden", "Not allowed to block this vehicle.");
    }
    const startsAt = new Date(input.starts_at).getTime();
    const endsAt = new Date(input.ends_at).getTime();
    if (!Number.isFinite(startsAt) || !Number.isFinite(endsAt) || startsAt >= endsAt) {
        throw new errors_1.ApiException(400, "invalid_time_window", "Invalid block window start/end time.");
    }
    const blockWindow = {
        id: (0, ids_1.newId)("block"),
        vehicle_id: vehicleId,
        starts_at: input.starts_at,
        ends_at: input.ends_at,
        reason: input.reason,
        created_by: actor.userId,
        created_at: new Date().toISOString()
    };
    await (0, repository_1.insertVehicleBlock)(blockWindow);
    await (0, service_1.recordAudit)({
        actorId: actor.userId,
        actorRole: actor.role,
        action: "vehicle.block",
        resourceType: "vehicle",
        resourceId: vehicleId,
        metadata: {
            starts_at: input.starts_at,
            ends_at: input.ends_at,
            reason: input.reason
        }
    });
    return blockWindow;
}
