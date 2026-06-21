import type { Role } from "@/lib/types/domain";
import { auth } from "@/lib/auth/better-auth";
import {
  DASHBOARD_ACCESS_COOKIE,
  verifyDashboardAccessToken
} from "@/lib/auth/dashboard-access";
import { getUserOrThrow, upsertUser } from "@/lib/data/repository";
import { ApiException } from "@/lib/utils/errors";

export interface ActorContext {
  userId: string;
  role: Role;
}

const validRoles: Role[] = ["customer", "partner_investor", "admin"];

function isValidRole(value: unknown): value is Role {
  return typeof value === "string" && validRoles.includes(value as Role);
}

export async function requireActor(
  request: Request,
  allowedRoles?: Role[]
): Promise<ActorContext> {
  let session:
    | {
        user?: {
          id?: string;
          role?: Role;
          name?: string;
          email?: string;
        };
      }
    | null
    | undefined;

  try {
    session = (await auth.api.getSession({
      headers: request.headers
    })) as {
      user?: { id?: string; role?: Role };
    } | null;
  } catch {
    session = null;
  }

  let userId: string | null = session?.user?.id ?? null;
  let role: Role | null = null;

  if (userId) {
    try {
      const user = await getUserOrThrow(userId);
      if (user.deleted_at) {
        // Auto-wipe the legacy auth record so they can't stay signed in
        try {
          const { getSupabaseServiceClient } = await import("@/lib/data/repository");
          const supabase = getSupabaseServiceClient();
          await supabase.from("user").delete().eq("id", userId);
          const s = session as any;
          if (s?.session?.token) {
            await auth.api.revokeSession({ token: s.session.token, headers: request.headers });
          }
        } catch (e) {}

        throw new ApiException(
          401,
          "account_deleted",
          "This account has been deleted."
        );
      }
      role = user.role;
    } catch (error) {
      if (error instanceof ApiException && error.code === "account_deleted") {
        throw error;
      }

      const sessionRole = isValidRole(session?.user?.role) ? session?.user?.role : "customer";
      const sessionName =
        session?.user?.name?.trim() || session?.user?.email?.trim() || userId;

      const user = await upsertUser({
        id: userId,
        role: sessionRole,
        name: sessionName,
        city: "bengaluru",
        kyc_status: "not_started",
        email: session?.user?.email ?? null
      });
      role = user.role;
    }
  }

  if (!userId || !role) {
    const cookieHeader = request.headers.get("cookie") ?? "";
    const dashboardCookie = cookieHeader
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${DASHBOARD_ACCESS_COOKIE}=`))
      ?.slice(DASHBOARD_ACCESS_COOKIE.length + 1);
    const dashboardActor = await verifyDashboardAccessToken(
      dashboardCookie ? decodeURIComponent(dashboardCookie) : null
    );
    if (dashboardActor) {
      userId = dashboardActor.userId;
      role = dashboardActor.role;
    }
  }

  if (!userId || !role) {
    const allowDevHeaders =
      process.env.APP_ENV !== "production" &&
      process.env.ALLOW_DEV_HEADERS === "true";
    if (!allowDevHeaders) {
      throw new ApiException(401, "auth_required", "Authentication is required.");
    }
    userId = request.headers.get("x-user-id");
    const roleHeader = request.headers.get("x-role");
    if (!userId || !roleHeader) {
      throw new ApiException(
        401,
        "auth_required",
        "Missing authenticated session and development headers."
      );
    }
    role = roleHeader as Role;
  }

  if (!isValidRole(role)) {
    throw new ApiException(403, "invalid_role", "Invalid role.");
  }

  if (allowedRoles && !allowedRoles.includes(role)) {
    throw new ApiException(
      403,
      "forbidden",
      "You do not have permission for this action."
    );
  }

  return { userId, role };
}

// Backward compatibility for any existing sync call sites.
export function requireActorSync() {
  throw new ApiException(
    500,
    "invalid_auth_usage",
    "requireActor is async now. Use await requireActor(...)."
  );
}
