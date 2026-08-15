import { recordAudit } from "@/lib/audit/service";
import {
  getKycByRequestId,
  getKycRecordOrThrow,
  getUserOrThrow,
  listBookings,
  listManualReviewKyc,
  upsertKycRecord,
  upsertUser,
  updateBooking
} from "@/lib/data/repository";
import type { KycRecord, Role } from "@/lib/types/domain";
import { createDigilockerRequest } from "@/lib/integrations/setu-digilocker";
import { fetchDigilockerRequestStatus } from "@/lib/integrations/setu-digilocker";
import { assertCanTransition } from "@/lib/bookings/state-machine";
import { notifyAdmin, notifyUser } from "@/lib/notifications/service";
import { parseSetuDigilockerStatus, resolveKycCallbackStatus } from "@/lib/kyc/setu-status";
import { ApiException } from "@/lib/utils/errors";
import { newId } from "@/lib/utils/ids";

async function getOrCreateKycRecord(userId: string): Promise<KycRecord> {
  try {
    return await getKycRecordOrThrow(userId);
  } catch (error) {
    if (!(error instanceof ApiException) || error.code !== "kyc_not_found") {
      throw error;
    }
    return upsertKycRecord({
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

async function moveVerifiedBookingsToAdminReview(userId: string, trigger: string) {
  const user = await getUserOrThrow(userId);
  const pendingBookings = await listBookings({ userId, status: "pending_kyc" });
  await Promise.all(
    pendingBookings.map(async (booking) => {
      assertCanTransition(booking.status, "admin_review", trigger);
      const updated = await updateBooking(booking.id, {
        status: "payment_pending",
        updated_at: new Date().toISOString()
      });
      await Promise.all([
        notifyUser({
          userId,
          email: user.email,
          templateKey: "booking_submitted",
          payload: {
            booking_id: updated.id,
            vehicle_id: updated.vehicle_id
          }
        }),
        notifyAdmin({
          templateKey: "admin_booking_review_requested",
          payload: {
            booking_id: updated.id,
            user_id: updated.user_id,
            vehicle_id: updated.vehicle_id,
            status: updated.status
          }
        })
      ]);
    })
  );
}

export async function startDigilockerKyc(userId: string) {
  const user = await getUserOrThrow(userId);
  const kyc = await getOrCreateKycRecord(userId);

  const providerResponse = (await createDigilockerRequest()) as {
    id?: string;
    requestId?: string;
    referenceId?: string;
    url?: string;
    status?: string;
  };

  if (!providerResponse.requestId && !providerResponse.id) {
    throw new ApiException(502, "setu_invalid_response", "DigiLocker provider returned an invalid response.");
  }

  const requestId =
    providerResponse?.requestId ??
    providerResponse?.id ??
    kyc.request_id ??
    newId("kyc_req");
  const referenceId = providerResponse?.referenceId ?? newId("kyc_ref");

  const updatedKyc = await upsertKycRecord({
    ...kyc,
    status: "in_progress",
    request_id: requestId,
    reference_id: referenceId,
    updated_at: new Date().toISOString()
  });
  await upsertUser({
    ...user,
    kyc_status: "in_progress"
  });

  await recordAudit({
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

export async function getKycStatus(userId: string) {
  const kyc = await getOrCreateKycRecord(userId);
  return {
    user_id: userId,
    status: kyc.status,
    request_id: kyc.request_id,
    reference_id: kyc.reference_id,
    aadhaar_verified: kyc.aadhaar_verified,
    dl_verified: kyc.dl_verified,
    cibil_score: kyc.cibil_score ?? null,
    cibil_risk_band: kyc.cibil_risk_band ?? null,
    cibil_checked_at: kyc.cibil_checked_at ?? null,
    needs_manual_review: kyc.needs_manual_review,
    updated_at: kyc.updated_at
  };
}

export async function handleDigilockerCallback(input: {
  requestId?: string;
  status?: string;
  aadhaarVerified?: boolean;
  dlVerified?: boolean;
  cibilScore?: number | null;
  failureReason?: string;
  consentScopes?: string[];
}) {
  if (!input.requestId) {
    throw new ApiException(400, "request_id_required", "Missing requestId in callback.");
  }

  const current = await getKycByRequestId(input.requestId);
  if (!current) {
    throw new ApiException(404, "kyc_not_found", "No KYC record found for requestId.");
  }

  if (current.status === "verified") {
    return current;
  }

  const aadhaarVerified = Boolean(input.aadhaarVerified) || current.aadhaar_verified;
  const dlVerified = Boolean(input.dlVerified) || current.dl_verified;
  const status = resolveKycCallbackStatus({
    status: input.status,
    aadhaarVerified,
    dlVerified
  });

  if (current.status === "failed" && status === "failed") {
    return current;
  }

  const updated = await upsertKycRecord({
    ...current,
    status: status === "in_progress" ? "in_progress" : status,
    aadhaar_verified: aadhaarVerified,
    dl_verified: dlVerified,
    consent_scopes: input.consentScopes?.length
      ? input.consentScopes
      : current.consent_scopes,
    cibil_score: input.cibilScore ?? current.cibil_score ?? null,
    needs_manual_review: status === "manual_review",
    failure_reason: status === "failed" ? input.failureReason ?? undefined : undefined,
    updated_at: new Date().toISOString()
  });

  const user = await getUserOrThrow(current.user_id);
  await upsertUser({
    ...user,
    kyc_status: status === "in_progress" ? "in_progress" : status
  });

  if (status === "verified") {
    await moveVerifiedBookingsToAdminReview(current.user_id, "kyc.callback_verified");
  }

  await recordAudit({
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

export async function getKycRequestForActor(
  requestId: string,
  actor: { userId: string; role: Role }
) {
  const record = await getKycByRequestId(requestId);
  if (!record) {
    throw new ApiException(404, "kyc_not_found", "No KYC record found for requestId.");
  }
  if (actor.role !== "admin" && record.user_id !== actor.userId) {
    throw new ApiException(403, "forbidden", "Not allowed to access this KYC request.");
  }
  return record;
}

export async function markKycManualReview(userId: string, actorId: string) {
  const user = await getUserOrThrow(userId);
  const kyc = await getKycRecordOrThrow(userId);
  const updated = await upsertKycRecord({
    ...kyc,
    status: "manual_review",
    needs_manual_review: true,
    updated_at: new Date().toISOString()
  });
  await upsertUser({
    ...user,
    kyc_status: "manual_review"
  });

  await recordAudit({
    actorId,
    actorRole: "admin",
    action: "kyc.mark_manual_review",
    resourceType: "kyc",
    resourceId: userId
  });

  return updated;
}

export async function approveKyc(userId: string, actorId: string) {
  const user = await getUserOrThrow(userId);
  const kyc = await getKycRecordOrThrow(userId);
  const updated = await upsertKycRecord({
    ...kyc,
    status: "verified",
    needs_manual_review: false,
    aadhaar_verified: true,
    dl_verified: true,
    updated_at: new Date().toISOString()
  });
  await upsertUser({
    ...user,
    kyc_status: "verified"
  });

  await moveVerifiedBookingsToAdminReview(userId, "kyc.admin_approve");

  await recordAudit({
    actorId,
    actorRole: "admin",
    action: "kyc.approve",
    resourceType: "kyc",
    resourceId: userId
  });
  return updated;
}

export async function rejectKyc(userId: string, actorId: string, reason: string) {
  const user = await getUserOrThrow(userId);
  const kyc = await getKycRecordOrThrow(userId);
  const updated = await upsertKycRecord({
    ...kyc,
    status: "failed",
    needs_manual_review: false,
    failure_reason: reason,
    updated_at: new Date().toISOString()
  });
  await upsertUser({
    ...user,
    kyc_status: "failed"
  });

  await recordAudit({
    actorId,
    actorRole: "admin",
    action: "kyc.reject",
    resourceType: "kyc",
    resourceId: userId,
    metadata: { reason }
  });
  return updated;
}

export async function listPendingKycManualReview() {
  const pending = await listManualReviewKyc();
  return pending.map((item) => ({
    user_id: item.user_id,
    status: item.status,
    updated_at: item.updated_at,
    aadhaar_verified: item.aadhaar_verified,
    dl_verified: item.dl_verified,
    cibil_score: item.cibil_score ?? null,
    cibil_risk_band: item.cibil_risk_band ?? null,
    failure_reason: item.failure_reason ?? null
  }));
}

export async function pollDigilockerStatus(
  requestId: string,
  actor: { userId: string; role: Role }
) {
  await getKycRequestForActor(requestId, actor);
  const payload = (await fetchDigilockerRequestStatus(requestId)) as Record<string, unknown>;
  const parsed = parseSetuDigilockerStatus(payload);
  const status = await handleDigilockerCallback({
    requestId,
    status: parsed.status,
    aadhaarVerified: parsed.aadhaarVerified,
    dlVerified: parsed.dlVerified,
    cibilScore: parsed.cibilScore ?? null,
    failureReason: parsed.failureReason,
    consentScopes: parsed.consentScopes
  });

  return {
    provider_payload: payload,
    updated_status: status.status
  };
}
