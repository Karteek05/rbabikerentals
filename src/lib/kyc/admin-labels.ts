import type { KycStatus } from "@/lib/types/domain";

export function getKycAdminBadge(status?: KycStatus | null) {
  switch (status) {
    case "verified":
      return { label: "DigiLocker verified", badgeClass: "badge-verified" };
    case "in_progress":
      return { label: "DigiLocker in progress", badgeClass: "badge-pending" };
    case "manual_review":
      return { label: "DigiLocker consent given", badgeClass: "badge-admin_review" };
    case "failed":
      return { label: "DigiLocker failed", badgeClass: "badge-failed" };
    case "expired":
      return { label: "DigiLocker expired", badgeClass: "badge-pending" };
    case "not_started":
    default:
      return { label: "DigiLocker not done", badgeClass: "badge-inactive" };
  }
}
