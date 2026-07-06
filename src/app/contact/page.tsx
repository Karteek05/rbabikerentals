import type { Metadata } from "next";
import Link from "next/link";
import LegalPageShell, { LegalSection } from "@/app/components/LegalPageShell";
import { COMPANY } from "@/lib/legal/company";

export const metadata: Metadata = {
  title: "Contact | RBA Bike Rentals",
  description: "Contact RBA Bike Rentals for booking support, breakdowns, and account help in Bengaluru."
};

export default function ContactPage() {
  return (
    <LegalPageShell
      eyebrow="Contact"
      title="Get in touch"
      subtitle="Reach our support team for booking help, breakdowns, refunds, or account questions."
    >
      <LegalSection title="Email support">
        <p>
          For the fastest response, email{" "}
          <a
            href={`mailto:${COMPANY.supportEmail}?subject=RBA%20support%20request`}
            className="nav-focus font-semibold underline underline-offset-2"
          >
            {COMPANY.supportEmail}
          </a>{" "}
          with your booking reference, pickup date, and vehicle model.
        </p>
      </LegalSection>

      <LegalSection title="What to include">
        <ul className="list-disc space-y-2 pl-5">
          <li>Booking ID (from My Bookings or your confirmation email)</li>
          <li>Registered email and mobile number</li>
          <li>Pickup date and scooter model</li>
          <li>A short description of your question or issue</li>
        </ul>
      </LegalSection>

      <LegalSection title="Breakdowns and roadside help">
        <p>
          If you are on a live rental and the vehicle has a problem, stop safely first. Email{" "}
          <a
            href={`mailto:${COMPANY.supportEmail}?subject=RBA%20breakdown%20support`}
            className="nav-focus underline underline-offset-2"
          >
            {COMPANY.supportEmail}
          </a>{" "}
          with your location and booking reference. See our{" "}
          <Link href="/safety" className="nav-focus underline underline-offset-2">
            Safety guidelines
          </Link>{" "}
          for rider expectations.
        </p>
      </LegalSection>

      <LegalSection title="Self-service">
        <p>
          Many requests can be handled online: check booking status in{" "}
          <Link href="/my-bookings" className="nav-focus underline underline-offset-2">
            My Bookings
          </Link>
          , read the{" "}
          <Link href="/faq" className="nav-focus underline underline-offset-2">
            FAQ
          </Link>
          , or review our{" "}
          <Link href="/terms" className="nav-focus underline underline-offset-2">
            Terms
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="nav-focus underline underline-offset-2">
            Privacy Policy
          </Link>
          .
        </p>
      </LegalSection>

      <LegalSection title="Grievance officer">
        <p>
          For data protection grievances under the DPDP Act, 2023, contact{" "}
          <a
            href={`mailto:${COMPANY.grievanceEmail}?subject=RBA%20privacy%20grievance`}
            className="nav-focus underline underline-offset-2"
          >
            {COMPANY.grievanceEmail}
          </a>
          .
        </p>
      </LegalSection>
    </LegalPageShell>
  );
}
