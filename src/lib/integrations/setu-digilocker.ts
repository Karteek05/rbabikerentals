import { ApiException } from "@/lib/utils/errors";

function getSetuConfig() {
  const baseUrl = process.env.SETU_DIGILOCKER_BASE_URL;
  const clientId = process.env.SETU_CLIENT_ID;
  const clientSecret = process.env.SETU_CLIENT_SECRET;
  const productInstanceId = process.env.SETU_PRODUCT_INSTANCE_ID;
  const redirectUrl = process.env.SETU_REDIRECT_URL;

  if (!baseUrl || !clientId || !clientSecret || !productInstanceId || !redirectUrl) {
    throw new ApiException(
      500,
      "setu_env_missing",
      "Setu DigiLocker env vars are not fully configured."
    );
  }

  return { baseUrl, clientId, clientSecret, productInstanceId, redirectUrl };
}

export async function createDigilockerRequest() {
  const cfg = getSetuConfig();
  const requestPath = process.env.SETU_DIGILOCKER_REQUEST_PATH ?? "/api/digilocker";

  const response = await fetch(`${cfg.baseUrl}${requestPath}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-client-id": cfg.clientId,
      "x-client-secret": cfg.clientSecret,
      "x-product-instance-id": cfg.productInstanceId
    },
    body: JSON.stringify({
      redirectUrl: cfg.redirectUrl
    })
  });

  if (!response.ok) {
    throw new ApiException(
      502,
      "setu_request_failed",
      "Setu DigiLocker request creation failed."
    );
  }

  return response.json();
}

export async function fetchDigilockerRequestStatus(requestId: string) {
  const cfg = getSetuConfig();
  const statusPath = process.env.SETU_DIGILOCKER_STATUS_PATH ?? `/api/digilocker/${requestId}`;
  const response = await fetch(`${cfg.baseUrl}${statusPath}`, {
    method: "GET",
    headers: {
      "x-client-id": cfg.clientId,
      "x-client-secret": cfg.clientSecret,
      "x-product-instance-id": cfg.productInstanceId
    }
  });

  if (!response.ok) {
    throw new ApiException(
      502,
      "setu_status_failed",
      "Setu DigiLocker status fetch failed."
    );
  }

  return response.json();
}
