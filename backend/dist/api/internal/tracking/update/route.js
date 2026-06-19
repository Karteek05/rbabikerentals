"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const service_1 = require("../../../../lib/tracking/service");
const errors_1 = require("../../../../lib/utils/errors");
const http_1 = require("../../../../lib/utils/http");
async function POST(request) {
    try {
        const token = request.headers.get("x-job-secret");
        if (!token || token !== process.env.JOB_SECRET) {
            throw new errors_1.ApiException(401, "unauthorized_job", "Invalid job secret.");
        }
        const body = await (0, http_1.parseJson)(request);
        const updated = await (0, service_1.upsertTrackingLocation)(body);
        return (0, http_1.ok)({ location: updated });
    }
    catch (error) {
        return (0, http_1.fromError)(error);
    }
}
