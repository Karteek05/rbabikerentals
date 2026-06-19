"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
exports.POST = POST;
const context_1 = require("../../../lib/auth/context");
const vehicle_service_1 = require("../../../lib/admin/vehicle-service");
const http_1 = require("../../../lib/utils/http");
async function GET(request) {
    try {
        await (0, context_1.requireActor)(request, ["admin"]);
        const url = new URL(request.url);
        const includeInactive = url.searchParams.get("include_inactive") === "true";
        const vehicles = await (0, vehicle_service_1.listVehiclesForAdmin)({ includeInactive });
        return (0, http_1.ok)({ vehicles });
    }
    catch (error) {
        return (0, http_1.fromError)(error);
    }
}
async function POST(request) {
    try {
        const actor = await (0, context_1.requireActor)(request, ["admin"]);
        const body = await (0, http_1.parseJson)(request);
        const vehicle = await (0, vehicle_service_1.createVehicleByAdmin)(body, actor);
        return (0, http_1.ok)({ vehicle }, 201);
    }
    catch (error) {
        return (0, http_1.fromError)(error);
    }
}
