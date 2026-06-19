import { createAuthClient } from "better-auth/react";
import { emailOTPClient } from "better-auth/client/plugins";
import { getPublicAuthClientBaseUrl } from "@/lib/utils/app-url";

const baseURL = getPublicAuthClientBaseUrl();

export const authClient = createAuthClient({
  baseURL: baseURL ? baseURL : undefined,
  plugins: [emailOTPClient()]
});
