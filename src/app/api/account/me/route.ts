import { auth } from "@/lib/auth/better-auth";
import { DASHBOARD_ACCESS_COOKIE } from "@/lib/auth/dashboard-access";
import { requireActor } from "@/lib/auth/context";
import {
  anonymizeUserAccount,
  getUserOrThrow,
  reconcileAppUsersForCanonicalId,
  upsertUser
} from "@/lib/data/repository";
import { getSupabaseServiceClient } from "@/lib/db/supabase-client";
import { ApiException } from "@/lib/utils/errors";
import { ok, fromError, parseJson } from "@/lib/utils/http";

type UpdateAccountRequest = {
  name?: string;
  phone?: string | null;
};

function normalizePhone(value: string | null | undefined) {
  if (value === null || value === undefined) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 15) {
    throw new ApiException(400, "invalid_phone", "Enter a valid phone number.");
  }
  return digits;
}

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

      if (existingUser.email) {
        await reconcileAppUsersForCanonicalId(existingUser.id, existingUser.email);
      }
      const user = await getUserOrThrow(userId);

      return ok({ authenticated: true, user });
    } catch (error) {
      if (!(error instanceof ApiException && error.code === "user_not_found")) {
        throw error;
      }
      // A new auth user may not have an app profile yet; create it below.
    }

    const bootstrapped = await upsertUser({
      id: userId,
      role: "customer",
      name: sessionUser.name?.trim() || sessionUser.email?.trim() || "RBA Customer",
      city: "bengaluru",
      kyc_status: "not_started",
      email: sessionUser.email ?? null
    });

    if (bootstrapped.email) {
      await reconcileAppUsersForCanonicalId(bootstrapped.id, bootstrapped.email);
      const user = await getUserOrThrow(bootstrapped.id);
      return ok({ authenticated: true, user });
    }

    return ok({ authenticated: true, user: bootstrapped });
  } catch (error) {
    return fromError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const actor = await requireActor(request);
    const body = await parseJson<UpdateAccountRequest>(request);
    const existing = await getUserOrThrow(actor.userId);

    const nextName = body.name !== undefined ? body.name.trim() : existing.name;
    if (!nextName) {
      throw new ApiException(400, "invalid_name", "Name cannot be empty.");
    }

    const nextPhone =
      body.phone !== undefined ? normalizePhone(body.phone) : existing.phone ?? null;

    const updated = await upsertUser({
      ...existing,
      name: nextName,
      phone: nextPhone ?? null
    });

    if (nextName !== existing.name) {
      try {
        const supabase = getSupabaseServiceClient();
        await supabase
          .from("user")
          .update({
            name: nextName,
            updatedAt: new Date().toISOString()
          })
          .eq("id", actor.userId);
      } catch (syncError) {
        console.error("Failed to sync auth display name:", syncError);
      }
    }

    return ok({ user: updated });
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
