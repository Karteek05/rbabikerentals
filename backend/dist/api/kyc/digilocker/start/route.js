"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const context_1 = require("../../../../lib/auth/context");
const service_1 = require("../../../../lib/kyc/service");
const http_1 = require("../../../../lib/utils/http");
const errors_1 = require("../../../../lib/utils/errors");
async function POST(request) {
    try {
        const actor = await (0, context_1.requireActor)(request, ["customer", "admin"]);
        const body = await (0, http_1.parseJson)(request);
        if (actor.role === "customer" && actor.userId !== body.user_id) {
            throw new errors_1.ApiException(403, "forbidden", "Customer can start KYC only for own user.");
        }
        const result = await (0, service_1.startDigilockerKyc)(body.user_id);
        return (0, http_1.ok)(result, 201);
    }
    catch (error) {
        return (0, http_1.fromError)(error);
    }
}
