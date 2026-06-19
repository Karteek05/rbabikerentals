"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireActor = requireActor;
exports.requireActorSync = requireActorSync;
const better_auth_1 = require("../../lib/auth/better-auth");
const repository_1 = require("../../lib/data/repository");
const errors_1 = require("../../lib/utils/errors");
const validRoles = ["customer", "partner_investor", "admin"];
function isValidRole(value) {
    return typeof value === "string" && validRoles.includes(value);
}
async function requireActor(request, allowedRoles) {
    let session;
    try {
        session = (await better_auth_1.auth.api.getSession({
            headers: request.headers
        }));
    }
    catch {
        session = null;
    }
    let userId = session?.user?.id ?? null;
    let role = null;
    if (userId) {
        try {
            const user = await (0, repository_1.getUserOrThrow)(userId);
            role = user.role;
        }
        catch {
            const sessionRole = isValidRole(session?.user?.role) ? session?.user?.role : "customer";
            const sessionName = session?.user?.name?.trim() || session?.user?.email?.trim() || userId;
            const user = await (0, repository_1.upsertUser)({
                id: userId,
                role: sessionRole,
                name: sessionName,
                city: "bengaluru",
                kyc_status: "not_started"
            });
            role = user.role;
        }
    }
    if (!userId || !role) {
        const allowDevHeaders = process.env.APP_ENV !== "production" &&
            process.env.ALLOW_DEV_HEADERS === "true";
        if (!allowDevHeaders) {
            throw new errors_1.ApiException(401, "auth_required", "Authentication is required.");
        }
        userId = request.headers.get("x-user-id");
        const roleHeader = request.headers.get("x-role");
        if (!userId || !roleHeader) {
            throw new errors_1.ApiException(401, "auth_required", "Missing authenticated session and development headers.");
        }
        role = roleHeader;
    }
    if (!isValidRole(role)) {
        throw new errors_1.ApiException(403, "invalid_role", "Invalid role.");
    }
    if (allowedRoles && !allowedRoles.includes(role)) {
        throw new errors_1.ApiException(403, "forbidden", "You do not have permission for this action.");
    }
    return { userId, role };
}
// Backward compatibility for any existing sync call sites.
function requireActorSync() {
    throw new errors_1.ApiException(500, "invalid_auth_usage", "requireActor is async now. Use await requireActor(...).");
}
