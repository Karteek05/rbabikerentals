"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.recordAudit = recordAudit;
const repository_1 = require("../../lib/data/repository");
const ids_1 = require("../../lib/utils/ids");
async function recordAudit(params) {
    await (0, repository_1.insertAuditEvent)({
        id: (0, ids_1.newId)("audit"),
        actor_id: params.actorId,
        actor_role: params.actorRole,
        action: params.action,
        resource_type: params.resourceType,
        resource_id: params.resourceId,
        metadata: params.metadata,
        created_at: new Date().toISOString()
    });
}
