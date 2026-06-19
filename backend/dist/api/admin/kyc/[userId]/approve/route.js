"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const context_1 = require("../../../../../lib/auth/context");
const service_1 = require("../../../../../lib/kyc/service");
const http_1 = require("../../../../../lib/utils/http");
async function POST(request, context) {
    try {
        const actor = await (0, context_1.requireActor)(request, ["admin"]);
        const { userId } = await context.params;
        const record = await (0, service_1.approveKyc)(userId, actor.userId);
        return (0, http_1.ok)({ kyc: record });
    }
    catch (error) {
        return (0, http_1.fromError)(error);
    }
}
