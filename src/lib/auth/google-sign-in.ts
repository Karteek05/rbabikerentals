import { authClient } from "@/lib/auth/auth-client";

export const isGoogleAuthEnabled = Boolean(process.env.GOOGLE_CLIENT_ID);

export async function startGoogleSignIn(callbackURL: string) {
  const { data, error } = await authClient.signIn.social({
    provider: "google",
    callbackURL
  });

  if (error) {
    const message = error.message?.trim();
    if (message) return { ok: false as const, error: message };
    return {
      ok: false as const,
      error:
        "Google sign-in is not available right now. Check that GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and BETTER_AUTH_URL are configured for this deployment."
    };
  }

  if (data?.url && !data.redirect) {
    window.location.href = data.url;
  }

  return { ok: true as const };
}
