import { requireActor } from "@/lib/auth/context";
import { getBookingInvoice } from "@/lib/invoices/service";
import { fromError, ok } from "@/lib/utils/http";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireActor(request, ["customer", "admin"]);
    const { id } = await context.params;
    const invoice = await getBookingInvoice(id, actor);
    return ok({ invoice });
  } catch (error) {
    return fromError(error);
  }
}
