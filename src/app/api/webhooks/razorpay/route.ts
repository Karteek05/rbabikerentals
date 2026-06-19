import { processRazorpayWebhook } from "@/lib/payments/service";
import { ok, fromError } from "@/lib/utils/http";

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get("x-razorpay-signature");
    const result = await processRazorpayWebhook({ rawBody, signature });
    return ok(result);
  } catch (error) {
    return fromError(error);
  }
}

