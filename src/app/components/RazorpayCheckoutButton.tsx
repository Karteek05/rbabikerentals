"use client";

import { useState } from "react";
import { openRazorpayCheckout } from "@/lib/payments/razorpay-checkout-client";

interface RazorpayCheckoutButtonProps {
  bookingId: string;
  description?: string;
  onSuccess?: () => void;
  onError?: (error: unknown) => void;
}

export default function RazorpayCheckoutButton({
  bookingId,
  description,
  onSuccess,
  onError
}: RazorpayCheckoutButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePayment = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/payments/order", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ booking_id: bookingId })
      });

      const orderData = await res.json();

      if (!res.ok || !orderData.ok) {
        throw new Error(orderData?.error?.message || "Failed to create order");
      }

      const order = orderData.data.order;
      if (order.provider === "upi_fallback") {
        throw new Error("Online payment is not configured for this booking.");
      }

      if (!order.key_id || !order.order_id) {
        throw new Error("Razorpay checkout is not configured.");
      }

      await openRazorpayCheckout({
        keyId: order.key_id,
        amount: order.amount,
        currency: order.currency,
        orderId: order.order_id,
        description: description ?? `Payment for booking ${bookingId}`,
        onSuccess: () => {
          onSuccess?.();
          alert("Payment submitted. Your booking will update once payment is confirmed.");
        },
        onFailure: (message) => {
          setError(message);
          onError?.(new Error(message));
        },
        onDismiss: () => {
          setError("Payment window closed before completion.");
        }
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      setError(message);
      onError?.(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center">
      <button
        onClick={handlePayment}
        disabled={loading}
        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
      >
        {loading ? "Processing..." : "Pay with Razorpay"}
      </button>

      {error && <p className="mt-2 text-red-500 text-sm">{error}</p>}
    </div>
  );
}
