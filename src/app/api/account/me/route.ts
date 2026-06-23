import { auth } from "@/lib/auth/better-auth";
import { DASHBOARD_ACCESS_COOKIE } from "@/lib/auth/dashboard-access";
import { requireActor } from "@/lib/auth/context";
import {
  anonymizeUserAccount,
  getUserOrThrow,
  upsertUser
} from "@/lib/data/repository";
import { getSupabaseServiceClient } from "@/lib/db/supabase-client";
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


export async function GET(request: Request) {
  try {
    const cookieHeader = request.headers.get("cookie") ?? "";

    let session: AuthSession | null = null;
    try {
      session = (await auth.api.getSession({
        headers: request.headers
      })) as AuthSession | null;
    } catch {
      session = null;
    }

    const sessionUser = session?.user;
    const userId = sessionUser?.id;
    if (!userId) {
      return ok({ authenticated: false, user: null });
    }

    try {
      const existingUser = await getUserOrThrow(userId);
      if (existingUser.deleted_at) {
        // For accounts deleted before the auth wipe fix, clean them up now
        try {
          const supabase = getSupabaseServiceClient();
          await supabase.from("user").delete().eq("id", userId);
          const s = session as any;
          if (s?.session?.token) {
            await auth.api.revokeSession({ body: { token: s.session.token }, headers: request.headers });
          }
        } catch (e) {
          console.error("Cleanup failed", e);
        }
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
