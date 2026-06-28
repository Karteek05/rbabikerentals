"use client";

import { useState } from 'react';
import Script from 'next/script';

interface RazorpayCheckoutButtonProps {
  amount: number; // Amount in paise (minimum 100)
  currency?: string;
  onSuccess?: (details: any) => void;
  onError?: (error: any) => void;
}

export default function RazorpayCheckoutButton({
  amount,
  currency = 'INR',
  onSuccess,
  onError
}: RazorpayCheckoutButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePayment = async () => {
    if (amount < 100) {
      setError("Amount must be at least 100 paise (₹1).");
      if (onError) onError(new Error("Amount too low"));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Create order on the backend
      const res = await fetch('/api/create-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ amount, currency }),
      });

      const orderData = await res.json();

      if (!res.ok) {
        throw new Error(orderData.error || 'Failed to create order');
      }

      // 2. Initialize Razorpay Checkout
      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID, // Enter the Key ID generated from the Dashboard
        amount: orderData.amount, // Amount is in currency subunits. Default currency is INR. Hence, 50000 refers to 50000 paise
        currency: orderData.currency,
        name: "RBA Bike Rentals",
        description: "Test Transaction",
        order_id: orderData.order_id, //This is a sample Order ID. Pass the `id` obtained in the response of Step 1
        handler: async function (response: any) {
          try {
            // 3. Verify payment signature on the backend
            const verifyRes = await fetch('/api/verify-payment', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              }),
            });

            const verifyData = await verifyRes.json();

            if (!verifyRes.ok || !verifyData.success) {
              throw new Error(verifyData.error || 'Payment verification failed');
            }

            if (onSuccess) onSuccess(verifyData);
            alert("Payment Successful!");
          } catch (err: any) {
            console.error("Verification error:", err);
            setError(err.message || "Payment verification failed");
            if (onError) onError(err);
          }
        },
        prefill: {
          name: "Test User",
          email: "test@example.com",
          contact: "9999999999"
        },
        theme: {
          color: "#3399cc"
        },
      };

      const razorpay = new (window as any).Razorpay(options);
      
      razorpay.on('payment.failed', function (response: any){
        console.error("Payment failed:", response.error);
        setError(`Payment failed: ${response.error.description}`);
        if (onError) onError(response.error);
      });
      
      razorpay.open();
    } catch (err: any) {
      console.error('Payment error:', err);
      setError(err.message || 'Something went wrong');
      if (onError) onError(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center">
      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        strategy="lazyOnload"
      />
      
      <button
        onClick={handlePayment}
        disabled={loading}
        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
      >
        {loading ? 'Processing...' : 'Pay with Razorpay'}
      </button>
      
      {error && (
        <p className="mt-2 text-red-500 text-sm">{error}</p>
      )}
    </div>
  );
}
