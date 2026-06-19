import { requireActor } from "@/lib/auth/context";
import { computePricingQuote } from "@/lib/pricing/engine";
import type { QuoteRequest } from "@/lib/types/contracts";
import { parseJson, ok, fromError } from "@/lib/utils/http";
import { assertBengaluruCity } from "@/lib/data/repository";
import { ApiException } from "@/lib/utils/errors";

export async function POST(request: Request) {
  try {
    const actor = await requireActor(request, ["customer", "admin"]);
    const body = await parseJson<QuoteRequest>(request);
    assertBengaluruCity(body.city);

    if (actor.role === "customer" && actor.userId !== body.user_id) {
      throw new ApiException(
        403,
        "forbidden",
        "Customer can only request quotes for own user_id."
      );
    }

    const quote = await computePricingQuote(body);
    return ok(quote, 201);
  } catch (error) {
    return fromError(error);
  }
}
