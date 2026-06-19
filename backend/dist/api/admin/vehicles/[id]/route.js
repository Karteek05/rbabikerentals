"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PATCH = PATCH;
exports.DELETE = DELETE;
const context_1 = require("../../../../lib/auth/context");
const vehicle_service_1 = require("../../../../lib/admin/vehicle-service");
const http_1 = require("../../../../lib/utils/http");
async function PATCH(request, context) {
    try {
        const actor = await (0, context_1.requireActor)(request, ["admin"]);
        const body = await (0, http_1.parseJson)(request);
        const { id } = await context.params;
        const vehicle = await (0, vehicle_service_1.updateVehicleByAdmin)(id, body, actor);
        return (0, http_1.ok)({ vehicle });
    }
    catch (error) {
        return (0, http_1.fromError)(error);
    }
}
async function DELETE(request, context) {
    try {
        const actor = await (0, context_1.requireActor)(request, ["admin"]);
        const { id } = await context.params;
        const vehicle = await (0, vehicle_service_1.deleteVehicleByAdmin)(id, actor);
        return (0, http_1.ok)({ vehicle });
    }
    catch (error) {
        return (0, http_1.fromError)(error);
    }
}
