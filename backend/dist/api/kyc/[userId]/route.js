"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const context_1 = require("../../../lib/auth/context");
const service_1 = require("../../../lib/kyc/service");
const errors_1 = require("../../../lib/utils/errors");
const http_1 = require("../../../lib/utils/http");
async function GET(request, context) {
    try {
        const actor = await (0, context_1.requireActor)(request, ["customer", "admin"]);
        const { userId } = await context.params;
        if (actor.role === "customer" && actor.userId !== userId) {
            throw new errors_1.ApiException(403, "forbidden", "Customer can view only own KYC status.");
        }
        const kyc = await (0, service_1.getKycStatus)(userId);
        return (0, http_1.ok)(kyc);
    }
    catch (error) {
        return (0, http_1.fromError)(error);
    }
}
