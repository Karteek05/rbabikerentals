"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseJson = parseJson;
exports.ok = ok;
exports.fail = fail;
exports.fromError = fromError;
const errors_1 = require("../../lib/utils/errors");
async function parseJson(request) {
    try {
        return (await request.json());
    }
    catch {
        throw new errors_1.ApiException(400, "bad_json", "Request body must be valid JSON.");
    }
}
function ok(data, status = 200) {
    const body = { ok: true, data };
    return json(body, status);
}
function fail(status, code, message) {
    const body = { ok: false, error: { code, message } };
    return json(body, status);
}
function fromError(error) {
    if (error instanceof errors_1.ApiException) {
        if (error.status >= 500) {
            console.error(error);
            return fail(error.status, error.code, "Unexpected server error.");
        }
        return fail(error.status, error.code, error.message);
    }
    console.error(error);
    return fail(500, "internal_error", "Unexpected server error.");
}
function json(body, status) {
    return new Response(JSON.stringify(body), {
        status,
        headers: {
            "content-type": "application/json; charset=utf-8"
        }
    });
}
