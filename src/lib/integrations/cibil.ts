import { ApiException } from "@/lib/utils/errors";

export type CibilRiskBand = "low" | "medium" | "high" | "unknown";

export interface CibilCheckInput {
  userId: string;
  legalName: string;
  panNumber: string;
  dateOfBirth: string;
  mobile: string;
  consent: boolean;
}

export interface CibilCheckResult {
  score: number | null;
  riskBand: CibilRiskBand;
  providerReference: string;
}

function normalizePan(panNumber: string) {
  return panNumber.trim().toUpperCase();
}

function scoreFromPan(panNumber: string) {
  const normalized = normalizePan(panNumber);
  const total = [...normalized].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return 650 + (total % 170);
}

function riskBandForScore(score: number | null): CibilRiskBand {
  if (!score) return "unknown";
  if (score >= 750) return "low";
  if (score >= 680) return "medium";
  return "high";
}

export async function fetchCibilSignal(input: CibilCheckInput): Promise<CibilCheckResult> {
  if (!input.consent) {
    throw new ApiException(400, "cibil_consent_required", "CIBIL consent is required.");
  }

  const providerMode = process.env.CIBIL_PROVIDER_MODE ?? "mock";
  if (providerMode !== "mock") {
    const apiUrl = process.env.CIBIL_API_URL;
    const apiKey = process.env.CIBIL_API_KEY;
    if (!apiUrl || !apiKey) {
      throw new ApiException(500, "cibil_env_missing", "CIBIL provider env vars are missing.");
    }
    throw new ApiException(
      501,
      "cibil_provider_not_implemented",
      "Live CIBIL provider mapping must be implemented after provider contract hand-off."
    );
  }

  const score = scoreFromPan(input.panNumber);
  return {
    score,
    riskBand: riskBandForScore(score),
    providerReference: `mock_cibil_${input.userId}_${normalizePan(input.panNumber).slice(-4)}`
  };
}
