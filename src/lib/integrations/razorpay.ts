import crypto from "crypto";
import { ApiException } from "@/lib/utils/errors";

export function isRazorpayConfigured() {
  return Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
}

export async function createRazorpayOrder(params: {
  amountInPaise: number;
  currency?: "INR";
  receipt: string;
}): Promise<{
  provider: "razorpay";
  key_id: string;
  order_id: string;
  amount: number;
  currency: "INR";
  receipt: string;
  status: string;
}> {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!isRazorpayConfigured() || !keyId || !keySecret) {
    throw new ApiException(
      500,
      "razorpay_env_missing",
      "Razorpay keys are not configured."
    );
  }

  const authHeader = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
  const response = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: `Basic ${authHeader}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      amount: params.amountInPaise,
      currency: params.currency ?? "INR",
      receipt: params.receipt,
      notes: {
        platform: "rbabikerentals"
      }
    })
  });

  if (!response.ok) {
    await response.text();
    console.error("Razorpay order creation failed", response.status);
    throw new ApiException(502, "razorpay_order_create_failed", "Payment provider is temporarily unavailable.");
  }

  const order = (await response.json()) as {
    id: string;
    amount: number;
    currency: "INR";
    receipt: string;
    status: string;
  };

  return {
    provider: "razorpay" as const,
    key_id: keyId,
    order_id: order.id,
    amount: order.amount,
    currency: order.currency,
    receipt: order.receipt,
    status: order.status
  };
}

export async function createRazorpayRefund(params: {
  paymentId: string;
  amountInPaise: number;
  notes?: Record<string, string>;
  idempotencyKey?: string;
}): Promise<{
  provider: "razorpay";
  refund_id: string;
  payment_id: string;
  amount: number;
  currency: "INR";
  status: string;
}> {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    throw new ApiException(
      500,
      "razorpay_env_missing",
      "Razorpay keys are not configured."
    );
  }

  const authHeader = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
  const response = await fetch(
    `https://api.razorpay.com/v1/payments/${params.paymentId}/refund`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${authHeader}`,
        "Content-Type": "application/json",
        ...(params.idempotencyKey
          ? { "X-Razorpay-Idempotency-Key": params.idempotencyKey }
          : {})
      },
      body: JSON.stringify({
        amount: params.amountInPaise,
        speed: "normal",
        notes: {
          platform: "rbabikerentals",
          ...(params.notes ?? {})
        }
      })
    }
  );

  if (!response.ok) {
    await response.text();
    console.error("Razorpay refund creation failed", response.status);
    throw new ApiException(502, "razorpay_refund_create_failed", "Refund provider is temporarily unavailable.");
  }

  const refund = (await response.json()) as {
    id: string;
    payment_id: string;
    amount: number;
    currency: "INR";
    status: string;
  };

  return {
    provider: "razorpay",
    refund_id: refund.id,
    payment_id: refund.payment_id,
    amount: refund.amount,
    currency: refund.currency,
    status: refund.status
  };
}

export function verifyRazorpayCheckoutSignature(params: {
  orderId: string;
  paymentId: string;
  signature: string;
}) {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) {
    throw new ApiException(
      500,
      "razorpay_env_missing",
      "Razorpay key secret is not configured."
    );
  }
  const digest = crypto
    .createHmac("sha256", secret)
    .update(`${params.orderId}|${params.paymentId}`)
    .digest("hex");
  return digest === params.signature;
}

export function verifyRazorpaySignature(params: {
  orderId: string;
  paymentId: string;
  signature: string;
}) {
  return verifyRazorpayCheckoutSignature(params);
}

function getRazorpayAuthHeader() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    throw new ApiException(
      500,
      "razorpay_env_missing",
      "Razorpay keys are not configured."
    );
  }
  return Buffer.from(`${keyId}:${keySecret}`).toString("base64");
}

export async function fetchRazorpayOrder(orderId: string) {
  const authHeader = getRazorpayAuthHeader();
  const response = await fetch(`https://api.razorpay.com/v1/orders/${orderId}`, {
    headers: {
      Authorization: `Basic ${authHeader}`
    }
  });

  if (!response.ok) {
    await response.text();
    console.error("Razorpay order fetch failed", response.status);
    throw new ApiException(502, "razorpay_order_fetch_failed", "Payment provider is temporarily unavailable.");
  }

  return (await response.json()) as {
    id: string;
    status: string;
    amount: number;
  };
}

export async function fetchCapturedPaymentForOrder(orderId: string) {
  const authHeader = getRazorpayAuthHeader();
  const response = await fetch(`https://api.razorpay.com/v1/orders/${orderId}/payments`, {
    headers: {
      Authorization: `Basic ${authHeader}`
    }
  });

  if (!response.ok) {
    await response.text();
    console.error("Razorpay payment lookup failed", response.status);
    throw new ApiException(502, "razorpay_order_payments_fetch_failed", "Payment provider is temporarily unavailable.");
  }

  const data = (await response.json()) as {
    items: Array<{ id: string; status: string; amount: number }>;
  };

  return data.items.find((payment) => payment.status === "captured") ?? null;
}

export async function createRazorpayPaymentLink(params: {
  amountInPaise: number;
  currency?: "INR";
  receipt: string;
  description: string;
  customer?: {
    name?: string;
    email?: string;
    contact?: string;
  };
}) {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    throw new ApiException(
      500,
      "razorpay_env_missing",
      "Razorpay keys are not configured."
    );
  }

  const authHeader = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
  const response = await fetch("https://api.razorpay.com/v1/payment_links", {
    method: "POST",
    headers: {
      Authorization: `Basic ${authHeader}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      amount: params.amountInPaise,
      currency: params.currency ?? "INR",
      accept_partial: false,
      reference_id: params.receipt,
      description: params.description,
      customer: params.customer,
      notify: {
        sms: false,
        email: false
      },
      reminder_enable: true,
      notes: {
        platform: "rbabikerentals"
      }
    })
  });

  if (!response.ok) {
    await response.text();
    console.error("Razorpay payment-link creation failed", response.status);
    throw new ApiException(502, "razorpay_payment_link_failed", "Payment provider is temporarily unavailable.");
  }

  const data = await response.json();
  return {
    id: data.id,
    short_url: data.short_url,
    status: data.status
  };
}
