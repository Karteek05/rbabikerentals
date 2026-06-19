# Google sign-in and profile account controls

This project uses Better Auth for email/password and Google sign-in. The app now links signed-in customers to `/profile`, supports `authClient.signOut()`, and lets customers delete their app profile by anonymizing PII while preserving booking history.

## Vercel environment variables

Set these in the Vercel project for Production:

```text
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
NEXT_PUBLIC_GOOGLE_CLIENT_ID=...
BETTER_AUTH_SECRET=...
BETTER_AUTH_URL=https://rbabikerentals.vercel.app
NEXT_PUBLIC_BETTER_AUTH_URL=https://rbabikerentals.vercel.app
```

`NEXT_PUBLIC_GOOGLE_CLIENT_ID` should match `GOOGLE_CLIENT_ID` so the login and signup pages can show the Google button.

## Google OAuth console

In the Google Cloud OAuth client, add:

```text
Authorized JavaScript origin:
https://rbabikerentals.vercel.app

Authorized redirect URI:
https://rbabikerentals.vercel.app/api/auth/callback/google
```

If a preview deployment is used for testing, add that preview deployment URL as another origin and callback URL.

## Sign-out behavior

Customer sign-out calls Better Auth through `authClient.signOut()` and then redirects to `/`. The profile delete action calls `DELETE /api/account/me`, anonymizes the app profile, and signs out the browser session.

## Deleted account behavior

Deleting an account does not delete historical bookings. It clears app-level PII from `app_users`, sets `deleted_at`, and blocks future app API access for that same auth user ID. To restore a deleted account, clear `deleted_at` and re-add the customer details from an admin-only database workflow.
