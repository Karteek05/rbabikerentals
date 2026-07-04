import { listBookings } from "../src/lib/data/repository";

async function main() {
  const userId = "49AIlUFNaWlTnEpOz5yjpGR2gO3UvACz";
  const bookings = await listBookings({ userId });
  console.log(`Bookings for ${userId}:`, bookings.length);
  for (const booking of bookings) {
    console.log(`  ${booking.id} | ${booking.status}`);
  }
}

main().catch(console.error);
