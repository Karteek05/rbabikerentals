"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const context_1 = require("../../../../../lib/auth/context");
const service_1 = require("../../../../../lib/admin/service");
const http_1 = require("../../../../../lib/utils/http");
async function POST(request, context) {
    try {
        const actor = await (0, context_1.requireActor)(request, ["admin"]);
        const body = await (0, http_1.parseJson)(request);
        const { id } = await context.params;
        const booking = await (0, service_1.rejectBooking)(id, body, actor);
        return (0, http_1.ok)({ booking });
    }
    catch (error) {
        return (0, http_1.fromError)(error);
    }
}
