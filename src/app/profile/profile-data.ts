import type { Booking, User } from "@/lib/types/domain";

export type AccountResponse = {
  authenticated: boolean;
  user: User | null;
  accountDeleted?: boolean;
};

type ApiEnvelope<T> = {
  ok?: boolean;
  data?: T;
};

export function readAccountPayload(payload: unknown): AccountResponse {
  const envelope = payload as ApiEnvelope<AccountResponse>;
  if (envelope?.ok && envelope.data) {
    return envelope.data;
  }

  return payload as AccountResponse;
}

export function readBookingsPayload(payload: unknown): Booking[] {
  const envelope = payload as ApiEnvelope<{ bookings?: Booking[] }>;
  if (envelope?.ok && envelope.data) {
    return envelope.data.bookings ?? [];
  }

  return ((payload as { bookings?: Booking[] })?.bookings ?? []);
}
