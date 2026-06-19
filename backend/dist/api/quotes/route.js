"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const context_1 = require("../../lib/auth/context");
const engine_1 = require("../../lib/pricing/engine");
const http_1 = require("../../lib/utils/http");
const repository_1 = require("../../lib/data/repository");
const errors_1 = require("../../lib/utils/errors");
async function POST(request) {
    try {
        const actor = await (0, context_1.requireActor)(request, ["customer", "admin"]);
        const body = await (0, http_1.parseJson)(request);
        (0, repository_1.assertBengaluruCity)(body.city);
        if (actor.role === "customer" && actor.userId !== body.user_id) {
            throw new errors_1.ApiException(403, "forbidden", "Customer can only request quotes for own user_id.");
        }
        const quote = await (0, engine_1.computePricingQuote)(body);
        return (0, http_1.ok)(quote, 201);
    }
    catch (error) {
        return (0, http_1.fromError)(error);
    }
}
