"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const context_1 = require("../../../../../lib/auth/context");
const service_1 = require("../../../../../lib/kyc/service");
const http_1 = require("../../../../../lib/utils/http");
async function GET(request, context) {
    try {
        const actor = await (0, context_1.requireActor)(request, ["customer", "admin"]);
        const { requestId } = await context.params;
        const result = await (0, service_1.pollDigilockerStatus)(requestId, actor);
        return (0, http_1.ok)(result);
    }
    catch (error) {
        return (0, http_1.fromError)(error);
    }
}
