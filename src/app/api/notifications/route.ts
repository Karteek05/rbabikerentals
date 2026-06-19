import { requireActor } from "@/lib/auth/context";
import { listNotificationJobs } from "@/lib/data/repository";
import { ok, fromError } from "@/lib/utils/http";

export async function GET(request: Request) {
  try {
    const actor = await requireActor(request, ["customer", "partner_investor", "admin"]);
    const url = new URL(request.url);
    const limit = Number(url.searchParams.get("limit") ?? "10");
    const recipient = actor.role === "admin" ? "admin_ops_team" : actor.userId;
    const items = await listNotificationJobs({
      recipient,
      channel: "in_app",
      limit: Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 50) : 10
    });
    return ok({ items });
  } catch (error) {
    return fromError(error);
  }
}
