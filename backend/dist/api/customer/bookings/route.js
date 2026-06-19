"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const context_1 = require("../../../lib/auth/context");
const repository_1 = require("../../../lib/data/repository");
const http_1 = require("../../../lib/utils/http");
async function GET(request) {
    try {
        const actor = await (0, context_1.requireActor)(request, ["customer", "admin"]);
        const url = new URL(request.url);
        const status = url.searchParams.get("status") ?? undefined;
        const bookings = actor.role === "admin"
            ? await (0, repository_1.listBookings)({ status })
            : await (0, repository_1.listBookings)({ status, userId: actor.userId });
        return (0, http_1.ok)({ bookings });
    }
    catch (error) {
        return (0, http_1.fromError)(error);
    }
}
