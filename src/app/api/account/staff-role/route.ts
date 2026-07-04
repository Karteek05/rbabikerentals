import { requireActor } from "@/lib/auth/context";
import { getUserOrThrow, upsertUser } from "@/lib/data/repository";
import type { Role } from "@/lib/types/domain";
import { ApiException } from "@/lib/utils/errors";
import { ok, fromError, parseJson } from "@/lib/utils/http";

type StaffRoleRequest = {
  role: Extract<Role, "admin" | "partner_investor">;
};

function isCompanyEmail(email: string | null | undefined) {
  return Boolean(email?.toLowerCase().endsWith("@rbabikerentals.com"));
}

export async function POST(request: Request) {
  try {
    const actor = await requireActor(request);
    const body = await parseJson<StaffRoleRequest>(request);
    const user = await getUserOrThrow(actor.userId);

    if (!isCompanyEmail(user.email)) {
      throw new ApiException(
        403,
        "forbidden",
        "Staff roles are limited to @rbabikerentals.com email addresses."
      );
    }

    if (body.role !== "admin" && body.role !== "partner_investor") {
      throw new ApiException(400, "invalid_role", "Staff role must be admin or partner_investor.");
    }

    if (user.role === body.role) {
      return ok({ user });
    }

    if (user.role !== "customer") {
      throw new ApiException(
        409,
        "role_change_not_allowed",
        "This account already has a different staff role."
      );
    }

    const updated = await upsertUser({
      ...user,
      role: body.role
    });

    return ok({ user: updated });
  } catch (error) {
    return fromError(error);
  }
}
