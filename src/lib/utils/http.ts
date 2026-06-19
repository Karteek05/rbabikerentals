import { NextResponse } from "next/server";
import type { ApiError, ApiSuccess } from "@/lib/types/contracts";
import { ApiException } from "@/lib/utils/errors";

export async function parseJson<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new ApiException(400, "bad_json", "Request body must be valid JSON.");
  }
}

export function ok<T>(data: T, status = 200) {
  const body: ApiSuccess<T> = { ok: true, data };
  return NextResponse.json(body, { status });
}

export function fail(status: number, code: string, message: string) {
  const body: ApiError = { ok: false, error: { code, message } };
  return NextResponse.json(body, { status });
}

export function fromError(error: unknown) {
  if (error instanceof ApiException) {
    if (error.status >= 500) {
      console.error(error);
      return fail(error.status, error.code, "Unexpected server error.");
    }
    return fail(error.status, error.code, error.message);
  }
  console.error(error);
  return fail(500, "internal_error", "Unexpected server error.");
}
