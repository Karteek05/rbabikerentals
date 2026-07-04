import {
  getUserOrThrow,
  listBookings,
  reconcileAppUsersForCanonicalId
} from "@/lib/data/repository";
import type { Booking } from "@/lib/types/domain";

export async function listCustomerBookings(params: {
  userId: string;
  status?: string;
}) {
  const user = await getUserOrThrow(params.userId);
  if (user.email) {
    await reconcileAppUsersForCanonicalId(params.userId, user.email);
  }

  const bookings = await listBookings({
    status: params.status,
    userId: params.userId,
    includeRelatedUserIds: true
  });

  return dedupeBookings(bookings);
}

function dedupeBookings(bookings: Booking[]) {
  const seen = new Set<string>();
  return bookings.filter((booking) => {
    if (seen.has(booking.id)) return false;
    seen.add(booking.id);
    return true;
  });
}
