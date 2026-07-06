import type { Metadata } from "next";
import Link from "next/link";
import LegalPageShell, { LegalSection } from "@/app/components/LegalPageShell";
import { COMPANY } from "@/lib/legal/company";

export const metadata: Metadata = {
  title: "About | RBA Bike Rentals",
  description: "About RBA Bike Rentals — scooter and two-wheeler rentals in Bengaluru."
};

export default function AboutPage() {
  return (
    <LegalPageShell
      eyebrow="About us"
      title="About RBA Bike Rentals"
      subtitle="Transparent two-wheeler rentals for Bengaluru riders, with GST-inclusive packages and local pickup support."
    >
      <LegalSection title="Who we are">
        <p>
          {COMPANY.brand} is a Bengaluru-focused bike rental service offering scooters and two-wheelers on weekly,
          15-day, and monthly packages. We combine online booking with an operations team that reviews every request
          before confirmation.
        </p>
      </LegalSection>

      <LegalSection title="What we offer">
        <ul className="list-disc space-y-2 pl-5">
          <li>GST-inclusive package pricing shown upfront during booking</li>
          <li>Pickup at Sarjapur Road with clear schedule selection</li>
          <li>Secure online payments through Razorpay (UPI, cards, and more)</li>
          <li>Booking extensions and support through My Bookings</li>
          <li>Refundable security deposit tied to return inspection</li>
        </ul>
      </LegalSection>

      <LegalSection title="How booking works">
        <p>
          Choose a vehicle, pick your dates, and submit a booking request. Our team reviews availability, then opens
          payment once approved. Track status updates in{" "}
          <Link href="/my-bookings" className="nav-focus underline underline-offset-2">
            My Bookings
          </Link>
          .
        </p>
      </LegalSection>

      <LegalSection title="Service area">
        <p>
          We currently operate in {COMPANY.city}, {COMPANY.state}, with pickup at Sarjapur Road. See{" "}
          <Link href="/browse" className="nav-focus underline underline-offset-2">
            available bikes
          </Link>{" "}
          for live package rates.
        </p>
      </LegalSection>
    </LegalPageShell>
  );
}
