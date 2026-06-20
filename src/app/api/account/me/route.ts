import { auth } from "@/lib/auth/better-auth";
import { DASHBOARD_ACCESS_COOKIE } from "@/lib/auth/dashboard-access";
import { requireActor } from "@/lib/auth/context";
import {
  anonymizeUserAccount,
  getUserOrThrow,
  upsertUser
} from "@/lib/data/repository";
import { ApiException } from "@/lib/utils/errors";
import { ok, fromError } from "@/lib/utils/http";

type AuthSession = {
  user?: {
    id?: string;
    name?: string;
    email?: string;
    role?: "customer" | "partner_investor" | "admin";
  };
};

async function getDevCustomerFallback() {
  if (process.env.APP_ENV === "production") {
    return null;
  }

  try {
    return await getUserOrThrow("cust_001");
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  try {
    const cookieHeader = request.headers.get("cookie") ?? "";

    let session: AuthSession | null = null;
    try {
      session = (await auth.api.getSession({
        headers: request.headers
      })) as AuthSession | null;
    } catch {
      const fallbackUser = await getDevCustomerFallback();
      return ok({
        authenticated: Boolean(fallbackUser),
        user: fallbackUser
      });
    }

    const sessionUser = session?.user;
    const userId = sessionUser?.id;
    if (!userId) {
      if (cookieHeader.includes(`${DASHBOARD_ACCESS_COOKIE}=`)) {
        return ok({ authenticated: false, user: null });
      }

      const fallbackUser = await getDevCustomerFallback();
      return ok({
        authenticated: Boolean(fallbackUser),
        user: fallbackUser
      });
    }

    try {
      const existingUser = await getUserOrThrow(userId);
      if (existingUser.deleted_at) {
        return ok({ authenticated: false, user: null, accountDeleted: true });
      }
    } catch (error) {
      if (!(error instanceof ApiException && error.code === "user_not_found")) {
        throw error;
      }
      // A new auth user may not have an app profile yet; create it below.
    }

    const user = await upsertUser({
      id: userId,
      role: sessionUser.role ?? "customer",
      name: sessionUser.name?.trim() || sessionUser.email?.trim() || "RBA Customer",
      city: "bengaluru",
      kyc_status: "not_started",
      email: sessionUser.email ?? null
    });

    return ok({ authenticated: true, user });
  } catch (error) {
    return fromError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const actor = await requireActor(request);
    const user = await anonymizeUserAccount(actor.userId);
    return ok({ user });
  } catch (error) {
    return fromError(error);
  }
}
