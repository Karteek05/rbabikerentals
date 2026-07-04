import type { Metadata } from "next";
import LegalPageShell, { LegalSection } from "@/app/components/LegalPageShell";
import { COMPANY } from "@/lib/legal/company";

export const metadata: Metadata = {
  title: "Safety Guidelines | RBA Bike Rentals",
  description: "Rider safety guidelines for scooter rentals in Bengaluru."
};

export default function SafetyPage() {
  return (
    <LegalPageShell
      title="Safety guidelines"
      subtitle="Practical safety expectations for every RBA rental in Bengaluru."
    >
      <LegalSection title="Before you ride">
        <p>
          Carry a valid driving licence for the class of vehicle rented. Wear an ISI-marked helmet at all times.
          Inspect tyres, brakes, lights, and indicators before leaving the pickup point. Report any defect to our team
          before use — do not ride a vehicle you believe is unsafe.
        </p>
      </LegalSection>

      <LegalSection title="On the road">
        <ul className="list-disc space-y-2 pl-5">
          <li>Follow all applicable Motor Vehicles Act rules and Bengaluru traffic regulations.</li>
          <li>Do not ride under the influence of alcohol or drugs.</li>
          <li>Avoid reckless riding, stunts, racing, or overloading the scooter.</li>
          <li>Use headlights after dark and in low-visibility conditions.</li>
          <li>Do not use a mobile phone while riding unless using hands-free navigation mounted safely.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Vehicle use limits">
        <p>
          Rented scooters are for lawful personal transport within agreed rental terms. Off-road use, commercial
          carriage of goods or passengers for hire, sub-letting, or tampering with the vehicle is not permitted.
          Stick to paved public roads unless our team has explicitly approved otherwise in writing.
        </p>
      </LegalSection>

      <LegalSection title="Accidents and breakdowns">
        <p>
          If you are involved in an accident, injury, or theft, contact local emergency services first where needed,
          then notify {COMPANY.brand} immediately at{" "}
          <a href={`mailto:${COMPANY.supportEmail}`} className="nav-focus underline underline-offset-2">
            {COMPANY.supportEmail}
          </a>
          . Do not admit fault or settle third-party claims without our guidance. For breakdowns, stop in a safe
          location and contact support — we will advise on roadside assistance or replacement where available.
        </p>
      </LegalSection>

      <LegalSection title="Insurance and liability">
        <p>
          Riders remain responsible for safe operation of the vehicle during the rental period. Any damage, traffic
          violations, fines, or third-party claims arising from misuse or negligence may be charged to the renter in
          line with our Terms &amp; Conditions and the security deposit process.
        </p>
      </LegalSection>

      <LegalSection title="Emergency contacts">
        <ul className="list-disc space-y-2 pl-5">
          <li>India emergency: 112</li>
          <li>Police: 100 · Ambulance: 108</li>
          <li>
            {COMPANY.brand} support:{" "}
            <a href={`mailto:${COMPANY.supportEmail}`} className="nav-focus underline underline-offset-2">
              {COMPANY.supportEmail}
            </a>
          </li>
        </ul>
      </LegalSection>
    </LegalPageShell>
  );
}
