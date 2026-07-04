import type { Metadata } from "next";
import LegalPageShell, { LegalSection } from "@/app/components/LegalPageShell";
import { COMPANY } from "@/lib/legal/company";

export const metadata: Metadata = {
  title: "Terms & Conditions | RBA Bike Rentals",
  description: "Terms and conditions for scooter rentals with RBA Bike Rentals in Bengaluru."
};

export default function TermsPage() {
  return (
    <LegalPageShell
      title="Terms & conditions"
      subtitle="Please read these terms before booking a scooter with RBA Bike Rentals."
    >
      <LegalSection title="1. Agreement">
        <p>
          By accessing {COMPANY.website}, creating an account, or completing a booking, you agree to these Terms
          &amp; Conditions, our{" "}
          <a href="/privacy" className="nav-focus underline underline-offset-2">
            Privacy Policy
          </a>
          , and{" "}
          <a href="/safety" className="nav-focus underline underline-offset-2">
            Safety guidelines
          </a>
          . If you do not agree, do not use our services.
        </p>
      </LegalSection>

      <LegalSection title="2. Eligibility">
        <ul className="list-disc space-y-2 pl-5">
          <li>You must be at least 18 years old.</li>
          <li>You must hold a valid driving licence appropriate for the rented vehicle class.</li>
          <li>You must provide accurate contact and booking information.</li>
          <li>We may refuse or cancel bookings at our discretion for safety, fraud, or operational reasons.</li>
        </ul>
      </LegalSection>

      <LegalSection title="3. Bookings and confirmation">
        <p>
          A booking request is subject to vehicle availability and internal review. A booking is confirmed only when
          status is updated to a confirmed or active rental state and any required payment or deposit steps are
          completed as communicated. Displayed availability is indicative and may change until confirmation.
        </p>
      </LegalSection>

      <LegalSection title="4. Pricing and payments">
        <ul className="list-disc space-y-2 pl-5">
          <li>Package fares shown on the website include GST unless stated otherwise.</li>
          <li>A refundable security deposit may apply and is collected as part of the booking flow.</li>
          <li>Extensions, late returns, damage charges, traffic fines, and fuel or accessory costs may be charged separately.</li>
          <li>Payments are processed through authorised payment partners. You agree to provide valid payment authorisation.</li>
        </ul>
      </LegalSection>

      <LegalSection title="5. Pickup, use, and return">
        <p>
          Pickup and return times and locations are as selected during booking or as agreed with our team. You must
          return the vehicle in substantially the same condition, subject to normal wear. Follow our safety guidelines
          and all traffic laws. The vehicle must not be used for illegal activity, commercial hire, racing, off-road
          riding, or modification without written approval.
        </p>
      </LegalSection>

      <LegalSection title="6. Cancellations and refunds">
        <p>
          Cancellation and refund outcomes depend on booking status, timing, and the applicable package tariff shown
          at booking. If a booking is rejected during review, eligible amounts will be refunded per our operational
          policy communicated at checkout or by support. Processing times for refunds may depend on your bank or payment
          provider.
        </p>
      </LegalSection>

      <LegalSection title="7. Damage, loss, and deposit">
        <p>
          You are responsible for loss or damage arising from your use, negligence, or breach of these terms, including
          theft where reasonable care was not taken. We may deduct applicable charges from the security deposit or
          recover additional amounts where permitted by law. Report incidents promptly to{" "}
          <a href={`mailto:${COMPANY.supportEmail}`} className="nav-focus underline underline-offset-2">
            {COMPANY.supportEmail}
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection title="8. Personal data">
        <p>
          We process personal data as described in our Privacy Policy, including for booking fulfilment, payments,
          support, and compliance with the Digital Personal Data Protection Act, 2023. By using our services you
          acknowledge that notice.
        </p>
      </LegalSection>

      <LegalSection title="9. Limitation of liability">
        <p>
          To the maximum extent permitted by Indian law, {COMPANY.brand} is not liable for indirect, incidental, or
          consequential loss. Our aggregate liability for any claim relating to a rental is limited to the rental fees
          paid for that booking, except where liability cannot be limited by law (including death or personal injury
          caused by our proven negligence).
        </p>
      </LegalSection>

      <LegalSection title="10. Force majeure">
        <p>
          We are not responsible for delays or failure caused by events beyond reasonable control, including severe
          weather, government restrictions, strikes, or infrastructure failures.
        </p>
      </LegalSection>

      <LegalSection title="11. Governing law and disputes">
        <p>
          These terms are governed by the laws of India. Courts at Bengaluru, Karnataka shall have exclusive
          jurisdiction, subject to applicable consumer protection remedies available to you.
        </p>
      </LegalSection>

      <LegalSection title="12. Contact">
        <p>
          Questions about these terms:{" "}
          <a href={`mailto:${COMPANY.supportEmail}`} className="nav-focus underline underline-offset-2">
            {COMPANY.supportEmail}
          </a>
        </p>
      </LegalSection>
    </LegalPageShell>
  );
}
