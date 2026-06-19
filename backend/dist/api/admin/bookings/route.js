"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const context_1 = require("../../../lib/auth/context");
const service_1 = require("../../../lib/admin/service");
const http_1 = require("../../../lib/utils/http");
async function GET(request) {
    try {
        await (0, context_1.requireActor)(request, ["admin"]);
        const url = new URL(request.url);
        const status = url.searchParams.get("status") ?? undefined;
        const bookings = await (0, service_1.listBookingsForAdmin)({ status });
        return (0, http_1.ok)({ bookings });
    }
    catch (error) {
        return (0, http_1.fromError)(error);
    }
}
