"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeKycCallbackPayload = normalizeKycCallbackPayload;
exports.startDigilockerKyc = startDigilockerKyc;
exports.getKycStatus = getKycStatus;
exports.handleDigilockerCallback = handleDigilockerCallback;
exports.getKycRequestForActor = getKycRequestForActor;
exports.markKycManualReview = markKycManualReview;
exports.approveKyc = approveKyc;
exports.rejectKyc = rejectKyc;
exports.listPendingKycManualReview = listPendingKycManualReview;
exports.pollDigilockerStatus = pollDigilockerStatus;
const service_1 = require("../../lib/audit/service");
const repository_1 = require("../../lib/data/repository");
const setu_digilocker_1 = require("../../lib/integrations/setu-digilocker");
const setu_digilocker_2 = require("../../lib/integrations/setu-digilocker");
const errors_1 = require("../../lib/utils/errors");
const ids_1 = require("../../lib/utils/ids");
function readPath(input, path) {
    return path.reduce((current, key) => {
        if (typeof current !== "object" || current === null)
            return undefined;
        return current[key];
    }, input);
}
function firstValue(input, paths) {
    for (const path of paths) {
        const value = readPath(input, path);
        if (value !== undefined && value !== null && value !== "")
            return value;
    }
    return undefined;
}
function coerceBoolean(value) {
    if (typeof value === "boolean")
        return value;
    if (typeof value === "string") {
        const normalized = value.trim().toLowerCase();
        if (["true", "verified", "success", "matched", "yes"].includes(normalized))
            return true;
        if (["false", "failed", "failure", "mismatch", "no"].includes(normalized))
            return false;
    }
    return undefined;
}
function coerceCibilScore(value) {
    if (value === null)
        return null;
    const numberValue = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(numberValue))
        return undefined;
    const score = Math.round(numberValue);
    if (score < 300 || score > 900) {
        throw new errors_1.ApiException(400, "invalid_cibil_score", "CIBIL score must be between 300 and 900.");
    }
    return score;
}
function resolveCibilRiskLevel(score) {
    if (score === null || score === undefined)
        return null;
    const highRiskThreshold = Number(process.env.CIBIL_HIGH_RISK_BELOW ?? 650);
    const mediumRiskThreshold = Number(process.env.CIBIL_MEDIUM_RISK_BELOW ?? 700);
    if (score < highRiskThreshold)
        return "high";
    if (score < mediumRiskThreshold)
        return "medium";
    return "low";
}
function normalizeKycCallbackPayload(input) {
    const statusValue = firstValue(input, [
        ["status"],
        ["data", "status"],
        ["event", "status"],
        ["digilocker", "status"],
        ["verification", "status"]
    ]);
    const normalizedStatus = typeof statusValue === "string" ? statusValue.trim().toLowerCase() : undefined;
    const requestId = firstValue(input, [
        ["requestId"],
        ["request_id"],
        ["id"],
        ["data", "requestId"],
        ["data", "request_id"],
        ["data", "id"],
        ["digilocker", "requestId"],
        ["digilocker", "request_id"]
    ]);
    const aadhaarValue = firstValue(input, [
        ["aadhaarVerified"],
        ["aadhaar_verified"],
        ["aadhaar", "verified"],
        ["data", "aadhaarVerified"],
        ["data", "aadhaar_verified"],
        ["documents", "aadhaar", "verified"]
    ]);
    const dlValue = firstValue(input, [
        ["dlVerified"],
        ["dl_verified"],
        ["drivingLicenseVerified"],
        ["driving_license_verified"],
        ["driving_license", "verified"],
        ["data", "dlVerified"],
        ["data", "dl_verified"],
        ["documents", "driving_license", "verified"]
    ]);
    const cibilValue = firstValue(input, [
        ["cibilScore"],
        ["cibil_score"],
        ["creditScore"],
        ["credit_score"],
        ["data", "cibilScore"],
        ["data", "cibil_score"],
        ["bureau", "cibil_score"]
    ]);
    const failureReason = firstValue(input, [
        ["failureReason"],
        ["failure_reason"],
        ["error"],
        ["error", "message"],
        ["data", "failureReason"],
        ["data", "failure_reason"]
    ]);
    return {
        requestId: typeof requestId === "string" ? requestId : undefined,
        status: normalizedStatus === "verified" ||
            normalizedStatus === "success" ||
            normalizedStatus === "completed"
            ? "verified"
            : normalizedStatus === "failed" || normalizedStatus === "failure"
                ? "failed"
                : normalizedStatus === "manual_review" || normalizedStatus === "review_required"
                    ? "manual_review"
                    : undefined,
        aadhaarVerified: coerceBoolean(aadhaarValue),
        dlVerified: coerceBoolean(dlValue),
        cibilScore: coerceCibilScore(cibilValue),
        failureReason: typeof failureReason === "string" ? failureReason : undefined
    };
}
function resolveKycCallbackStatus(input) {
    if (input.status === "failed") {
        return "failed";
    }
    if (input.status === "verified") {
        return input.aadhaarVerified && input.dlVerified && input.cibilRiskLevel !== "high"
            ? "verified"
            : "manual_review";
    }
    return "manual_review";
}
async function getOrCreateKycRecord(userId) {
    try {
        return await (0, repository_1.getKycRecordOrThrow)(userId);
    }
    catch (error) {
        if (!(error instanceof errors_1.ApiException) || error.code !== "kyc_not_found") {
            throw error;
        }
        return (0, repository_1.upsertKycRecord)({
            user_id: userId,
            status: "not_started",
            provider: "setu_digilocker",
            aadhaar_verified: false,
            dl_verified: false,
            needs_manual_review: false,
            updated_at: new Date().toISOString()
        });
    }
}
async function startDigilockerKyc(userId) {
    const user = await (0, repository_1.getUserOrThrow)(userId);
    const kyc = await getOrCreateKycRecord(userId);
    let providerResponse = null;
    try {
        providerResponse = (await (0, setu_digilocker_1.createDigilockerRequest)());
    }
    catch {
        providerResponse = null;
    }
    const requestId = providerResponse?.requestId ??
        providerResponse?.id ??
        kyc.request_id ??
        (0, ids_1.newId)("kyc_req");
    const referenceId = providerResponse?.referenceId ?? (0, ids_1.newId)("kyc_ref");
    const updatedKyc = await (0, repository_1.upsertKycRecord)({
        ...kyc,
        status: "in_progress",
        request_id: requestId,
        reference_id: referenceId,
        updated_at: new Date().toISOString()
    });
    await (0, repository_1.upsertUser)({
        ...user,
        kyc_status: "in_progress"
    });
    await (0, service_1.recordAudit)({
        actorId: userId,
        actorRole: user.role,
        action: "kyc.start_digilocker",
        resourceType: "kyc",
        resourceId: userId,
        metadata: {
            request_id: updatedKyc.request_id,
            reference_id: updatedKyc.reference_id
        }
    });
    return {
        user_id: userId,
        provider: "setu_digilocker",
        request_id: updatedKyc.request_id,
        reference_id: updatedKyc.reference_id,
        status: updatedKyc.status,
        redirect_url: providerResponse?.url ?? null,
        next_step: providerResponse?.url
            ? "redirect_to_digilocker_consent"
            : "poll_kyc_status"
    };
}
async function getKycStatus(userId) {
    const kyc = await getOrCreateKycRecord(userId);
    return {
        user_id: userId,
        status: kyc.status,
        request_id: kyc.request_id,
        reference_id: kyc.reference_id,
        aadhaar_verified: kyc.aadhaar_verified,
        dl_verified: kyc.dl_verified,
        cibil_score: kyc.cibil_score ?? null,
        needs_manual_review: kyc.needs_manual_review,
        updated_at: kyc.updated_at
    };
}
async function handleDigilockerCallback(input) {
    if (!input.requestId) {
        throw new errors_1.ApiException(400, "request_id_required", "Missing requestId in callback.");
    }
    const current = await (0, repository_1.getKycByRequestId)(input.requestId);
    if (!current) {
        throw new errors_1.ApiException(404, "kyc_not_found", "No KYC record found for requestId.");
    }
    const cibilScore = input.cibilScore ?? current.cibil_score ?? null;
    const cibilRiskLevel = resolveCibilRiskLevel(cibilScore);
    const status = resolveKycCallbackStatus({ ...input, cibilRiskLevel });
    const updated = await (0, repository_1.upsertKycRecord)({
        ...current,
        status,
        aadhaar_verified: Boolean(input.aadhaarVerified),
        dl_verified: Boolean(input.dlVerified),
        cibil_score: cibilScore,
        cibil_risk_level: cibilRiskLevel,
        needs_manual_review: status === "manual_review",
        failure_reason: input.failureReason ??
            (cibilRiskLevel === "high" ? "cibil_score_below_policy_threshold" : undefined),
        updated_at: new Date().toISOString()
    });
    const user = await (0, repository_1.getUserOrThrow)(current.user_id);
    await (0, repository_1.upsertUser)({
        ...user,
        kyc_status: status
    });
    await (0, service_1.recordAudit)({
        actorId: "system_kyc_callback",
        actorRole: "admin",
        action: "kyc.callback_processed",
        resourceType: "kyc",
        resourceId: current.user_id,
        metadata: {
            request_id: input.requestId,
            status
        }
    });
    return updated;
}
async function getKycRequestForActor(requestId, actor) {
    const record = await (0, repository_1.getKycByRequestId)(requestId);
    if (!record) {
        throw new errors_1.ApiException(404, "kyc_not_found", "No KYC record found for requestId.");
    }
    if (actor.role !== "admin" && record.user_id !== actor.userId) {
        throw new errors_1.ApiException(403, "forbidden", "Not allowed to access this KYC request.");
    }
    return record;
}
async function markKycManualReview(userId, actorId) {
    const user = await (0, repository_1.getUserOrThrow)(userId);
    const kyc = await (0, repository_1.getKycRecordOrThrow)(userId);
    const updated = await (0, repository_1.upsertKycRecord)({
        ...kyc,
        status: "manual_review",
        needs_manual_review: true,
        updated_at: new Date().toISOString()
    });
    await (0, repository_1.upsertUser)({
        ...user,
        kyc_status: "manual_review"
    });
    await (0, service_1.recordAudit)({
        actorId,
        actorRole: "admin",
        action: "kyc.mark_manual_review",
        resourceType: "kyc",
        resourceId: userId
    });
    return updated;
}
async function approveKyc(userId, actorId) {
    const user = await (0, repository_1.getUserOrThrow)(userId);
    const kyc = await (0, repository_1.getKycRecordOrThrow)(userId);
    const updated = await (0, repository_1.upsertKycRecord)({
        ...kyc,
        status: "verified",
        needs_manual_review: false,
        aadhaar_verified: true,
        dl_verified: true,
        updated_at: new Date().toISOString()
    });
    await (0, repository_1.upsertUser)({
        ...user,
        kyc_status: "verified"
    });
    await (0, service_1.recordAudit)({
        actorId,
        actorRole: "admin",
        action: "kyc.approve",
        resourceType: "kyc",
        resourceId: userId
    });
    return updated;
}
async function rejectKyc(userId, actorId, reason) {
    const user = await (0, repository_1.getUserOrThrow)(userId);
    const kyc = await (0, repository_1.getKycRecordOrThrow)(userId);
    const updated = await (0, repository_1.upsertKycRecord)({
        ...kyc,
        status: "failed",
        needs_manual_review: false,
        failure_reason: reason,
        updated_at: new Date().toISOString()
    });
    await (0, repository_1.upsertUser)({
        ...user,
        kyc_status: "failed"
    });
    await (0, service_1.recordAudit)({
        actorId,
        actorRole: "admin",
        action: "kyc.reject",
        resourceType: "kyc",
        resourceId: userId,
        metadata: { reason }
    });
    return updated;
}
async function listPendingKycManualReview() {
    const pending = await (0, repository_1.listManualReviewKyc)();
    return pending.map((item) => ({
        user_id: item.user_id,
        status: item.status,
        updated_at: item.updated_at
    }));
}
async function pollDigilockerStatus(requestId, actor) {
    await getKycRequestForActor(requestId, actor);
    const payload = (await (0, setu_digilocker_2.fetchDigilockerRequestStatus)(requestId));
    const normalized = normalizeKycCallbackPayload({ requestId, ...payload });
    const status = await handleDigilockerCallback({
        requestId,
        status: normalized.status,
        aadhaarVerified: normalized.aadhaarVerified,
        dlVerified: normalized.dlVerified,
        cibilScore: normalized.cibilScore,
        failureReason: normalized.failureReason
    });
    return {
        provider_payload: payload,
        updated_status: status.status
    };
}
