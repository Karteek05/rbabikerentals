import { auth } from "@/lib/auth/better-auth";
import { wrapAuthHandler } from "@/lib/auth/auth-route";
import { toNextJsHandler } from "better-auth/next-js";

const handler = toNextJsHandler(auth);

export const GET = wrapAuthHandler((request) => handler.GET(request));
export const POST = wrapAuthHandler((request) => handler.POST(request));
export const PATCH = wrapAuthHandler((request) => handler.PATCH(request));
export const PUT = wrapAuthHandler((request) => handler.PUT(request));
export const DELETE = wrapAuthHandler((request) => handler.DELETE(request));
