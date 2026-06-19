"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const context_1 = require("../../../lib/auth/context");
const google_maps_1 = require("../../../lib/integrations/google-maps");
const http_1 = require("../../../lib/utils/http");
async function POST(request) {
    try {
        await (0, context_1.requireActor)(request, ["customer", "partner_investor", "admin"]);
        const body = await (0, http_1.parseJson)(request);
        const result = await (0, google_maps_1.distanceMatrix)(body);
        return (0, http_1.ok)(result);
    }
    catch (error) {
        return (0, http_1.fromError)(error);
    }
}
