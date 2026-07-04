import type { Metadata } from "next";
import Link from "next/link";
import LegalPageShell, { LegalSection } from "@/app/components/LegalPageShell";
import { COMPANY } from "@/lib/legal/company";

export const metadata: Metadata = {
  title: "Cookie Notice | RBA Bike Rentals",
  description: "How RBA Bike Rentals uses cookies and similar technologies."
};

export default function CookiesPage() {
  return (
    <LegalPageShell
      title="Cookie notice"
      subtitle="A short explanation of cookies and similar technologies used on our website."
    >
      <LegalSection title="What are cookies?">
        <p>
          Cookies are small text files stored on your device when you visit a website. They help the site remember your
          session, keep you signed in, and protect against misuse.
        </p>
      </LegalSection>

      <LegalSection title="Cookies we use">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Essential / authentication:</strong> session and sign-in cookies required to operate your account
            and complete bookings securely.
          </li>
          <li>
            <strong>Security:</strong> cookies that help detect abuse and maintain safe access to admin and customer
            areas.
          </li>
          <li>
            <strong>Payment checkout:</strong> when you pay, our payment partner may set cookies or similar storage as
            needed to complete the transaction.
          </li>
        </ul>
        <p>
          We do not use non-essential advertising cookies on the public rental site at this time. If that changes, we
          will update this notice and, where required under the DPDP Act, seek consent before optional tracking.
        </p>
      </LegalSection>

      <LegalSection title="Managing cookies">
        <p>
          You can block or delete cookies in your browser settings. Blocking essential cookies may prevent sign-in,
          booking, or payment from working correctly.
        </p>
      </LegalSection>

      <LegalSection title="More information">
        <p>
          For how we handle personal data, see our{" "}
          <Link href="/privacy" className="nav-focus underline underline-offset-2">
            Privacy Policy
          </Link>
          . Questions:{" "}
          <a href={`mailto:${COMPANY.supportEmail}`} className="nav-focus underline underline-offset-2">
            {COMPANY.supportEmail}
          </a>
        </p>
      </LegalSection>
    </LegalPageShell>
  );
}
