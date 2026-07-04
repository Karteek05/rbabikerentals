export type RazorpayCheckoutOptions = {
  keyId: string;
  amount: number;
  currency: string;
  orderId: string;
  name?: string;
  description?: string;
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
  onSuccess?: () => void;
  onDismiss?: () => void;
  onFailure?: (message: string) => void;
};

type RazorpayInstance = {
  open: () => void;
  on: (event: string, handler: (response: unknown) => void) => void;
};

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance;
  }
}

export function loadRazorpayCheckoutScript() {
  return new Promise<boolean>((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }

    const existing = document.querySelector('script[data-razorpay-checkout="true"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(Boolean(window.Razorpay)));
      existing.addEventListener("error", () => resolve(false));
      return;
    }

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.dataset.razorpayCheckout = "true";
    script.onload = () => resolve(Boolean(window.Razorpay));
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export async function openRazorpayCheckout(options: RazorpayCheckoutOptions) {
  const loaded = await loadRazorpayCheckoutScript();
  if (!loaded || !window.Razorpay) {
    throw new Error("Razorpay checkout could not load in this browser.");
  }

  const checkoutOptions: Record<string, unknown> = {
    key: options.keyId,
    name: options.name ?? "RBA Bike Rentals",
    description: options.description,
    prefill: options.prefill,
    handler: () => {
      options.onSuccess?.();
    },
    modal: {
      ondismiss: () => {
        options.onDismiss?.();
      },
      escape: true,
      backdropclose: false
    },
    theme: {
      color: "#c78310"
    }
  };

  if (options.orderId) {
    // Amount and currency come from the server-created order.
    checkoutOptions.order_id = options.orderId;
  } else {
    checkoutOptions.amount = options.amount;
    checkoutOptions.currency = options.currency;
  }

  const checkout = new window.Razorpay(checkoutOptions);

  checkout.on("payment.failed", (response: unknown) => {
    const message =
      typeof response === "object" &&
      response !== null &&
      "error" in response &&
      typeof (response as { error?: { description?: string } }).error?.description === "string"
        ? (response as { error: { description: string } }).error.description
        : "Payment failed.";
    options.onFailure?.(message);
  });

  checkout.open();
}
