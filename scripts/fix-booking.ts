import { getSupabaseServiceClient } from "../src/lib/db/supabase-client";

async function fixBooking() {
  const supabase = getSupabaseServiceClient();

  // Find the booking
  const { data: bookings, error: findError } = await supabase
    .from("bookings")
    .select("*")
    .ilike("id", "booking_dca2b51e%");

  if (findError) {
    console.error("Error finding booking:", findError);
    return;
  }

  if (!bookings || bookings.length === 0) {
    console.error("Booking not found");
    return;
  }

  const booking = bookings[0];
  console.log("Found booking:", booking.id);

  // Update booking status to confirmed
  const { error: updateError } = await supabase
    .from("bookings")
    .update({ status: "confirmed", updated_at: new Date().toISOString() })
    .eq("id", booking.id);

  if (updateError) {
    console.error("Error updating booking:", updateError);
    return;
  }

  console.log("Successfully marked booking as confirmed!");
}

fixBooking();
