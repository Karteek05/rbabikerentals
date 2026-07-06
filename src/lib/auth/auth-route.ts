import { getServerAppBaseUrl, isProductionRuntime } from "@/lib/utils/app-url";

const AUTH_COOKIE_MARKERS = [
  "rba.session_token",
  "rba.session_data",
  "rba.dont_remember",
  "rba.account_data"
] as const;

function isAuthCookieName(name: string) {
  const bare = name.replace(/^__Secure-/, "");
  return AUTH_COOKIE_MARKERS.some(
    (marker) => bare === marker || bare.startsWith(`${marker}.`)
  );
}

export function collectAuthCookieNames(cookieHeader: string | null) {
  if (!cookieHeader) return [];

  const names: string[] = [];
  for (const part of cookieHeader.split(";")) {
    const name = part.trim().split("=")[0]?.trim();
    if (name && isAuthCookieName(name)) {
      names.push(name);
    }
  }

  return [...new Set(names)];
}

export function stripAuthCookieNames(cookieHeader: string | null, namesToStrip: Set<string>) {
  if (!cookieHeader || namesToStrip.size === 0) return cookieHeader;

  const kept = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .filter((part) => {
      const name = part.split("=")[0]?.trim() ?? "";
      return name && !namesToStrip.has(name);
    });

  return kept.length > 0 ? kept.join("; ") : null;
}

export function resolveAuthCookieDomain(
  env: Record<string, string | undefined> = process.env
) {
  if (!isProductionRuntime(env)) return undefined;

  const baseUrl = getServerAppBaseUrl(env);
  if (!baseUrl) return undefined;

  try {
    const host = new URL(baseUrl).hostname;
    if (host === "rbabikerentals.com" || host.endsWith(".rbabikerentals.com")) {
      return "rbabikerentals.com";
    }
  } catch {
    // ignore invalid base URL
  }

  return undefined;
}

export function expireAuthCookieHeader(
  name: string,
  domain = resolveAuthCookieDomain()
) {
  const secure = isProductionRuntime();
  const parts = [`${name}=`, "Path=/", "Max-Age=0", "HttpOnly", "SameSite=Lax"];
  if (domain) parts.push(`Domain=${domain}`);
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export function isGetSessionRequest(request: Request) {
  const url = new URL(request.url);
  return request.method === "GET" && url.pathname.endsWith("/get-session");
}

function appendExpiredCookies(headers: Headers, names: string[]) {
  for (const name of names) {
    headers.append("Set-Cookie", expireAuthCookieHeader(name));
  }
}

function cloneRequestWithCookieHeader(request: Request, cookieHeader: string | null) {
  const headers = new Headers(request.headers);
  if (cookieHeader) headers.set("cookie", cookieHeader);
  else headers.delete("cookie");

  return new Request(request.url, {
    method: request.method,
    headers
  });
}

async function recoverGetSession(
  handler: (request: Request) => Promise<Response>,
  request: Request,
  response: Response
) {
  const cookieHeader = request.headers.get("cookie");
  const sessionDataCookies = collectAuthCookieNames(cookieHeader).filter((name) =>
    name.includes("session_data")
  );

  if (sessionDataCookies.length > 0) {
    const strippedHeader = stripAuthCookieNames(
      cookieHeader,
      new Set(sessionDataCookies)
    );
    const retryResponse = await handler(
      cloneRequestWithCookieHeader(request, strippedHeader)
    );

    if (retryResponse.status < 500) {
      const headers = new Headers(retryResponse.headers);
      appendExpiredCookies(headers, sessionDataCookies);
      return new Response(retryResponse.body, {
        status: retryResponse.status,
        headers
      });
    }
  }

  if (sessionDataCookies.length === 0) {
    return response;
  }

  console.error(
    "get-session failed after stripping corrupt session_data cookies",
    response.status,
    cookieHeader?.slice(0, 240)
  );

  const headers = new Headers(response.headers);
  appendExpiredCookies(headers, sessionDataCookies);
  return new Response(response.body, {
    status: response.status,
    headers
  });
}

export function wrapAuthHandler(handler: (request: Request) => Promise<Response>) {
  return async (request: Request) => {
    const response = await handler(request);
    if (!isGetSessionRequest(request) || response.status < 500) {
      return response;
    }

    return recoverGetSession(handler, request, response);
  };
}
