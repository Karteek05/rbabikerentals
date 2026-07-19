import type { KycStatus } from "@/lib/types/domain";

export type CustomerRequirementState = "complete" | "pending" | "action";

export type CustomerRequirement = {
  id: "payment" | "aadhaar" | "dl";
  label: string;
  detail: string;
  state: CustomerRequirementState;
};

function docState(verified: boolean, kycStatus: KycStatus): CustomerRequirementState {
  if (verified) return "complete";
  if (kycStatus === "in_progress" || kycStatus === "manual_review") return "pending";
  return "action";
}

export function buildCustomerRequirements(input: {
  kycStatus: KycStatus;
  aadhaarVerified: boolean;
  dlVerified: boolean;
  paymentComplete: boolean;
}): CustomerRequirement[] {
  const requirements: CustomerRequirement[] = [
    {
      id: "payment",
      label: "Booking payment",
      detail: input.paymentComplete ? "Paid in full" : "Complete payment to confirm your ride",
      state: input.paymentComplete ? "complete" : "action"
    },
    {
      id: "aadhaar",
      label: "Aadhaar",
      detail: input.aadhaarVerified
        ? "Verified via DigiLocker"
        : input.kycStatus === "in_progress"
          ? "DigiLocker verification in progress"
          : input.kycStatus === "manual_review"
            ? "Consent received — syncing documents"
            : "Verify with DigiLocker before pickup",
      state: docState(input.aadhaarVerified, input.kycStatus)
    },
    {
      id: "dl",
      label: "Driving licence",
      detail: input.dlVerified
        ? "Verified via DigiLocker"
        : input.kycStatus === "in_progress"
          ? "DigiLocker verification in progress"
          : input.kycStatus === "manual_review"
            ? "Consent received — syncing documents"
            : "Share your valid DL through DigiLocker",
      state: docState(input.dlVerified, input.kycStatus)
    }
  ];

  return requirements;
}

export function requirementsNeedKycAction(requirements: CustomerRequirement[]) {
  return requirements.some(
    (item) => item.id !== "payment" && item.state === "action"
  );
}
