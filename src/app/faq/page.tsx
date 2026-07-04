import type { Metadata } from "next";
import Link from "next/link";
import LegalPageShell from "@/app/components/LegalPageShell";
import { COMPANY } from "@/lib/legal/company";

const FAQ_ITEMS = [
  {
    q: "Are package prices inclusive of GST?",
    a: "Yes. Weekly, 15-day, and monthly package rates shown on the website include GST, so you can compare fares directly."
  },
  {
    q: "What documents do I need to rent a scooter?",
    a: "You need a valid driving licence for the vehicle class, a government photo ID, and the contact details used during booking. Carry the licence when riding."
  },
  {
    q: "How does booking confirmation work?",
    a: "After you submit a booking, our team reviews fleet availability. You will see status updates in My Bookings. Payment steps are shared once the booking moves forward in the review flow."
  },
  {
    q: "What is the security deposit?",
    a: "A refundable deposit is collected with your booking. It covers potential damage, late return, or policy violations. Unused amounts are released after return inspection, subject to our terms."
  },
  {
    q: "What kilometre allowance is included?",
    a: "Included kilometres depend on your package (for example, weekly plans include a fixed km allowance shown at booking). Extra usage may be charged per the tariff communicated during checkout or extension."
  },
  {
    q: "Can I extend my rental?",
    a: "Yes, if the scooter is available. Use the extension option from your active booking. Extension charges are calculated from the applicable package rate and must be paid before the new drop time is confirmed."
  },
  {
    q: "What is your cancellation policy?",
    a: "Cancellation outcomes depend on booking status and how close you are to pickup. If we cannot confirm availability or you cancel within allowed windows, eligible refunds are processed to your original payment method where applicable."
  },
  {
    q: "Which payment methods are accepted?",
    a: "We accept online payments through our secure payment partner (UPI, cards, and other methods supported at checkout). Cash on pickup may be offered only when explicitly confirmed by our team."
  },
  {
    q: "Where can I pick up the scooter?",
    a: "Pickup locations are shown during booking. Our current service area focuses on Bengaluru, including Sarjapur Road and nearby zones as listed on the site."
  },
  {
    q: "What if the scooter breaks down?",
    a: "Stop safely and contact us at support@rbabikerentals.com with your booking reference. We will guide you on roadside assistance or a replacement where operationally possible."
  },
  {
    q: "Do I need a helmet?",
    a: "Yes. Always wear an ISI-marked helmet. See our Safety guidelines for full rider expectations."
  },
  {
    q: "How is my personal data handled?",
    a: "We process data under India's Digital Personal Data Protection Act, 2023. Read our Privacy Policy for details on collection, rights, and grievance contact."
  }
] as const;

export const metadata: Metadata = {
  title: "FAQ | RBA Bike Rentals",
  description: "Frequently asked questions about scooter rentals in Bengaluru with RBA Bike Rentals."
};

export default function FaqPage() {
  return (
    <LegalPageShell
      title="Frequently asked questions"
      subtitle="Quick answers about booking, payments, deposits, and riding with RBA in Bengaluru."
    >
      <div className="space-y-3">
        {FAQ_ITEMS.map((item) => (
          <details
            key={item.q}
            className="group rounded-xl border border-[color:var(--color-line)] bg-white px-5 py-4 open:shadow-sm"
          >
            <summary className="cursor-pointer list-none font-semibold text-[color:var(--color-ink)] marker:content-none [&::-webkit-details-marker]:hidden">
              <span className="flex items-start justify-between gap-4">
                {item.q}
                <span className="text-[color:var(--color-muted)] transition-transform group-open:rotate-45">+</span>
              </span>
            </summary>
            <p className="mt-3 text-sm leading-relaxed text-[color:var(--color-copy)]">{item.a}</p>
          </details>
        ))}
      </div>

      <section id="contact" className="mt-12 rounded-xl border border-[color:var(--color-line)] bg-white p-6">
        <h2 className="mb-2 text-lg font-bold text-[color:var(--color-ink)]">Still need help?</h2>
        <p className="mb-4 text-sm leading-relaxed text-[color:var(--color-copy)]">
          Email us with your booking reference, pickup date, and scooter model. We typically respond on business days.
        </p>
        <a
          href={`mailto:${COMPANY.supportEmail}?subject=RBA%20support%20request`}
          className="btn-primary inline-flex px-5 py-2.5 text-sm"
        >
          {COMPANY.supportEmail}
        </a>
        <p className="mt-4 text-xs text-[color:var(--color-muted)]">
          Legal notices:{" "}
          <Link href="/privacy" className="nav-focus underline underline-offset-2">
            Privacy
          </Link>
          {" · "}
          <Link href="/terms" className="nav-focus underline underline-offset-2">
            Terms
          </Link>
          {" · "}
          <Link href="/safety" className="nav-focus underline underline-offset-2">
            Safety
          </Link>
        </p>
      </section>
    </LegalPageShell>
  );
}
