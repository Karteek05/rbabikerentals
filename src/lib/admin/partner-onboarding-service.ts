import { recordAudit } from "@/lib/audit/service";
import { isApprovedPartner } from "@/lib/auth/partner-access";
import {
  getUserOrThrow,
  listApprovedPartners,
  listPartnerApplications,
  listVehiclesByOwner,
  upsertUser
} from "@/lib/data/repository";
import {
  notifyAdmin,
  notifyUser,
  resolveUserNotificationEmail,
  sendPartnerApplicationSubmittedEmail
} from "@/lib/notifications/service";
import type { PartnerApplicationStatus, Role, User } from "@/lib/types/domain";
import type { PartnerApplyRequest } from "@/lib/types/contracts";
import { ApiException } from "@/lib/utils/errors";
import { getCustomerFacingBaseUrl, getServerAppBaseUrl } from "@/lib/utils/app-url";

function normalizePhone(value: string | undefined) {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 15) {
    throw new ApiException(400, "invalid_phone", "Enter a valid phone number.");
  }
  return digits;
}

export async function submitPartnerApplication(
  userId: string,
  input: PartnerApplyRequest
) {
  const user = await getUserOrThrow(userId);
  if (user.role === "admin") {
    throw new ApiException(403, "forbidden", "Admin accounts cannot apply as partners.");
  }
  if (isApprovedPartner(user)) {
    throw new ApiException(409, "already_partner", "This account is already an approved partner.");
  }
  if (user.partner_application_status === "pending") {
    return { user, already_pending: true };
  }

  const now = new Date().toISOString();
  const nextName = input.name?.trim() || user.name;
  if (!nextName) {
    throw new ApiException(400, "invalid_name", "Name is required.");
  }

  const updated = await upsertUser({
    ...user,
    role: "customer",
    name: nextName,
    phone: input.phone !== undefined ? normalizePhone(input.phone) ?? null : user.phone ?? null,
    partner_business_name: input.partner_business_name?.trim() || user.partner_business_name || null,
    partner_application_status: "pending",
    partner_applied_at: now,
    partner_reviewed_at: null,
    partner_reviewed_by: null,
    partner_rejection_reason: null
  });

  await recordAudit({
    actorId: userId,
    actorRole: user.role,
    action: "partner.application_submitted",
    resourceType: "user",
    resourceId: userId,
    metadata: input.message ? { message: input.message } : undefined
  });

  const email = await resolveUserNotificationEmail(updated.id, updated.email);
  const adminUrl = `${(getServerAppBaseUrl() ?? "http://localhost:3000").replace(/\/$/, "")}/admin#partner-applications`;

  await Promise.all([
    notifyAdmin({
      templateKey: "partner_application_submitted",
      payload: {
        user_id: updated.id,
        name: updated.name,
        email: email ?? updated.email,
        phone: updated.phone,
        business_name: updated.partner_business_name,
        applied_at: updated.partner_applied_at
      }
    }),
    email
      ? sendPartnerApplicationSubmittedEmail(process.env.ADMIN_EMAIL || "admin@rbabikerentals.com", {
          name: updated.name,
          email,
          phone: updated.phone,
          business_name: updated.partner_business_name,
          applied_at: updated.partner_applied_at,
          admin_url: adminUrl
        })
      : Promise.resolve()
  ]);

  return { user: updated, already_pending: false };
}

export async function listPartnerApplicationsForAdmin(filter?: {
  status?: PartnerApplicationStatus | "all";
}) {
  const users = await listPartnerApplications(filter);
  return users
    .map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      partner_business_name: user.partner_business_name,
      partner_application_status:
        user.role === "partner_investor"
          ? ("approved" as const)
          : user.partner_application_status,
      partner_applied_at: user.partner_applied_at,
      partner_reviewed_at: user.partner_reviewed_at,
      partner_rejection_reason: user.partner_rejection_reason
    }))
    .sort((a, b) => (b.partner_applied_at ?? "").localeCompare(a.partner_applied_at ?? ""));
}

export async function approvePartnerApplication(
  userId: string,
  actor: { userId: string; role: Role }
) {
  if (actor.role !== "admin") {
    throw new ApiException(403, "forbidden", "Only admin can approve partner applications.");
  }

  const user = await getUserOrThrow(userId);
  if (user.partner_application_status !== "pending") {
    throw new ApiException(409, "invalid_state", "Only pending applications can be approved.");
  }

  const now = new Date().toISOString();
  const updated = await upsertUser({
    ...user,
    role: "partner_investor",
    partner_application_status: "approved",
    partner_reviewed_at: now,
    partner_reviewed_by: actor.userId,
    partner_rejection_reason: null
  });

  await recordAudit({
    actorId: actor.userId,
    actorRole: actor.role,
    action: "admin.partner_application_approved",
    resourceType: "user",
    resourceId: userId
  });

  const email = await resolveUserNotificationEmail(updated.id, updated.email);
  const loginUrl = `${(getCustomerFacingBaseUrl() ?? "http://localhost:3000").replace(/\/$/, "")}/partner-login`;

  if (email) {
    await notifyUser({
      userId: updated.id,
      email,
      templateKey: "partner_application_approved",
      payload: { login_url: loginUrl, partner_name: updated.name }
    });
  }

  return updated;
}

export async function rejectPartnerApplication(
  userId: string,
  actor: { userId: string; role: Role },
  reason?: string
) {
  if (actor.role !== "admin") {
    throw new ApiException(403, "forbidden", "Only admin can reject partner applications.");
  }

  const user = await getUserOrThrow(userId);
  if (user.partner_application_status !== "pending") {
    throw new ApiException(409, "invalid_state", "Only pending applications can be rejected.");
  }

  const now = new Date().toISOString();
  const rejectionReason = reason?.trim() || "Application not approved at this time.";
  const updated = await upsertUser({
    ...user,
    role: "customer",
    partner_application_status: "rejected",
    partner_reviewed_at: now,
    partner_reviewed_by: actor.userId,
    partner_rejection_reason: rejectionReason
  });

  await recordAudit({
    actorId: actor.userId,
    actorRole: actor.role,
    action: "admin.partner_application_rejected",
    resourceType: "user",
    resourceId: userId,
    metadata: { reason: rejectionReason }
  });

  const email = await resolveUserNotificationEmail(updated.id, updated.email);
  const reapplyUrl = `${(getCustomerFacingBaseUrl() ?? "http://localhost:3000").replace(/\/$/, "")}/partner-apply`;

  if (email) {
    await notifyUser({
      userId: updated.id,
      email,
      templateKey: "partner_application_rejected",
      payload: { reason: rejectionReason, reapply_url: reapplyUrl }
    });
  }

  return updated;
}

export async function listApprovedPartnersForAdmin() {
  const partners = await listApprovedPartners();
  const rows = await Promise.all(
    partners.map(async (partner) => {
      const vehicles = await listVehiclesByOwner(partner.id);
      return {
        id: partner.id,
        name: partner.name,
        email: partner.email,
        phone: partner.phone,
        partner_business_name: partner.partner_business_name,
        vehicle_count: vehicles.length
      };
    })
  );
  return rows.sort((a, b) => a.name.localeCompare(b.name));
}
