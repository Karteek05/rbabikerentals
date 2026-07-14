import { requireActor } from "@/lib/auth/context";
import { getUserOrThrow, upsertUser } from "@/lib/data/repository";
import { ApiException } from "@/lib/utils/errors";
import { ok, fromError, parseJson } from "@/lib/utils/http";
type StaffRoleRequest = {
  role: "admin";
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

    if (body.role !== "admin") {
      throw new ApiException(
        400,
        "invalid_role",
        "Partner access requires submitting an application at /partner-apply."
      );
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
