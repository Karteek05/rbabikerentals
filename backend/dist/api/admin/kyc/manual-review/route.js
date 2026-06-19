"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const context_1 = require("../../../../lib/auth/context");
const service_1 = require("../../../../lib/kyc/service");
const http_1 = require("../../../../lib/utils/http");
async function GET(request) {
    try {
        await (0, context_1.requireActor)(request, ["admin"]);
        const items = await (0, service_1.listPendingKycManualReview)();
        return (0, http_1.ok)({ items });
    }
    catch (error) {
        return (0, http_1.fromError)(error);
    }
}
