import type { Metadata } from "next";
import LegalPageShell, { LegalSection } from "@/app/components/LegalPageShell";
import { COMPANY } from "@/lib/legal/company";

export const metadata: Metadata = {
  title: "Privacy Policy | RBA Bike Rentals",
  description:
    "How RBA Bike Rentals collects, uses, and protects your personal data under India's Digital Personal Data Protection Act, 2023."
};

export default function PrivacyPage() {
  return (
    <LegalPageShell
      title="Privacy policy"
      subtitle="This notice explains how we handle personal data in line with the Digital Personal Data Protection Act, 2023 (DPDP Act) and applicable Indian law."
    >
      <LegalSection title="1. Who we are">
        <p>
          <strong>{COMPANY.brand}</strong> ({COMPANY.city}, {COMPANY.state}, {COMPANY.country}) is the{" "}
          <strong>Data Fiduciary</strong> for personal data processed through {COMPANY.website} and our rental
          operations. For privacy questions or to exercise your rights, contact us at{" "}
          <a href={`mailto:${COMPANY.grievanceEmail}`} className="nav-focus underline underline-offset-2">
            {COMPANY.grievanceEmail}
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection title="2. Personal data we collect">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Identity and contact:</strong> name, email address, mobile number, and pickup or delivery notes
            you provide.
          </li>
          <li>
            <strong>Booking and account:</strong> rental dates, vehicle choice, booking status, profile details, and
            support communications.
          </li>
          <li>
            <strong>Payment-related data:</strong> transaction references, amounts, and payment status from our payment
            partner. We do not store full card or UPI credentials on our servers.
          </li>
          <li>
            <strong>Technical data:</strong> IP address, browser type, device information, and cookies required for
            sign-in, security, and site functionality (see our{" "}
            <a href="/cookies" className="nav-focus underline underline-offset-2">
              Cookie notice
            </a>
            ).
          </li>
          <li>
            <strong>Verification data (when applicable):</strong> identity or licence-related information if you
            choose to submit it for booking review. We collect only what is necessary for the stated purpose.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="3. Why we use your data">
        <p>We process personal data for specific, lawful purposes, including:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>Creating and managing your account and bookings.</li>
          <li>Reviewing availability, confirming rentals, and providing customer support.</li>
          <li>Processing payments, refunds, deposits, and extension charges.</li>
          <li>Sending service messages such as booking updates, OTPs, and password resets.</li>
          <li>Preventing fraud, securing our platform, and meeting legal obligations.</li>
          <li>Improving our website and rental operations with aggregated, non-identifying analytics where used.</li>
        </ul>
        <p>
          Where the DPDP Act requires consent, we seek clear consent before processing your data for that purpose.
          Processing necessary to perform your rental contract or comply with law may not require separate consent.
        </p>
      </LegalSection>

      <LegalSection title="4. Consent and withdrawal">
        <p>
          By creating an account, submitting a booking, or signing in, you consent to processing as described in
          this policy. You may withdraw consent for optional processing (such as non-essential marketing) at any
          time by emailing{" "}
          <a href={`mailto:${COMPANY.grievanceEmail}`} className="nav-focus underline underline-offset-2">
            {COMPANY.grievanceEmail}
          </a>
          . Withdrawal does not affect processing already completed lawfully, or processing required to fulfil an
          active booking or legal duty.
        </p>
      </LegalSection>

      <LegalSection title="5. Your rights as a Data Principal">
        <p>Under the DPDP Act, you may have the right to:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>Obtain a summary of personal data we process and the processing activities involved.</li>
          <li>Access and obtain a copy of your personal data, subject to applicable exceptions.</li>
          <li>Correct inaccurate or incomplete personal data.</li>
          <li>Request erasure when retention is no longer necessary and law permits deletion.</li>
          <li>Withdraw consent and raise a grievance with us.</li>
          <li>Nominate another individual to exercise your rights in the event of death or incapacity, as permitted by law.</li>
        </ul>
        <p>
          Submit requests to{" "}
          <a href={`mailto:${COMPANY.grievanceEmail}`} className="nav-focus underline underline-offset-2">
            {COMPANY.grievanceEmail}
          </a>
          . We will respond within timelines prescribed under applicable law. If you are unsatisfied with our response,
          you may escalate to the Data Protection Board of India when that mechanism is available under the DPDP
          framework.
        </p>
      </LegalSection>

      <LegalSection title="6. Children">
        <p>
          Our services are not directed at individuals under 18. We do not knowingly collect personal data from
          children without verifiable parental or guardian consent. Contact us if you believe a child has provided data
          without appropriate consent.
        </p>
      </LegalSection>

      <LegalSection title="7. Data sharing and processors">
        <p>We share personal data only as needed with trusted processors who act on our instructions, such as:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>Cloud hosting and database providers.</li>
          <li>Payment gateway partners (e.g. Razorpay) for secure transactions.</li>
          <li>Email and notification delivery providers for account and booking messages.</li>
        </ul>
        <p>
          We require appropriate contractual safeguards. We do not sell your personal data. We may disclose data when
          required by law, court order, or to protect rights, safety, and property.
        </p>
      </LegalSection>

      <LegalSection title="8. Cross-border transfers">
        <p>
          Some processors may store or process data outside India. Where personal data is transferred internationally,
          we take reasonable steps to ensure protections consistent with the DPDP Act and applicable contractual
          safeguards.
        </p>
      </LegalSection>

      <LegalSection title="9. Retention">
        <p>
          We retain personal data only as long as needed for the purposes above, including active bookings, tax and
          accounting records, dispute resolution, and legal compliance. When data is no longer required, we delete or
          anonymise it in line with our retention practices.
        </p>
      </LegalSection>

      <LegalSection title="10. Security">
        <p>
          We use administrative, technical, and organisational measures such as access controls, encrypted connections
          (HTTPS), and restricted staff access. No method of transmission or storage is completely secure; please use
          a strong password and keep your login details confidential.
        </p>
      </LegalSection>

      <LegalSection title="11. Grievance redressal">
        <p>
          For complaints about how we handle personal data, email{" "}
          <a href={`mailto:${COMPANY.grievanceEmail}`} className="nav-focus underline underline-offset-2">
            {COMPANY.grievanceEmail}
          </a>{" "}
          with the subject line &quot;Privacy grievance&quot;. Include your name, contact details, and a description of
          your concern. We aim to acknowledge grievances promptly and resolve them within reasonable timelines under
          the DPDP Act.
        </p>
      </LegalSection>

      <LegalSection title="12. Changes to this policy">
        <p>
          We may update this policy from time to time. Material changes will be posted on this page with an updated
          date. Continued use of our services after changes constitutes notice of the updated policy where permitted
          by law.
        </p>
      </LegalSection>
    </LegalPageShell>
  );
}
