import { listPickupLocations } from "@/lib/data/repository";
import { fromError, ok } from "@/lib/utils/http";

export async function GET() {
  try {
    return ok({ items: await listPickupLocations(true) });
  } catch (error) {
    return fromError(error);
  }
}
