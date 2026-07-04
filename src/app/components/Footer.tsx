import Link from "next/link";
import Icon from "./Icon";

const FOOTER_LINKS = {
  Product: [
    { label: "Browse Bikes", href: "/browse" },
    { label: "How It Works", href: "/#how-it-works" },
    { label: "Pricing / Tariff", href: "/browse" },
    { label: "My Bookings", href: "/my-bookings" }
  ],
  Support: [
    { label: "FAQ & Contact", href: "/faq" },
    { label: "Safety", href: "/safety" },
    { label: "Privacy Policy", href: "/privacy" },
    { label: "Terms & Conditions", href: "/terms" }
  ],
  Partner: [
    { label: "Staff Access", href: "/staff-login" }
  ]
};

export default function Footer() {
  return (
    <footer className="bg-[color:var(--color-ink)] text-white">
      <div className="max-w-container mx-auto px-4 sm:px-6 pt-16 pb-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10 pb-12 border-b border-white/10">
          <div className="col-span-2 md:col-span-1">
            <div className="text-2xl font-black mb-4">RBA<span className="text-[color:var(--color-accent)]">.</span></div>
            <p className="text-white/60 text-sm leading-relaxed mb-5">
              Bengaluru scooter rentals with GST-inclusive weekly, 15-day, and monthly packages.
            </p>
            <div className="flex flex-col gap-2 text-xs">
              <Link href="/faq" className="nav-focus text-white/65 hover:text-white transition-colors inline-flex items-center gap-2">
                <Icon name="support" className="w-3.5 h-3.5" />
                FAQ &amp; Contact
              </Link>
              <a href="/login" className="nav-focus text-white/65 hover:text-white transition-colors inline-flex items-center gap-2">
                <Icon name="mail" className="w-3.5 h-3.5" />
                Account Login
              </a>
              <a href="/my-bookings" className="nav-focus text-white/65 hover:text-white transition-colors inline-flex items-center gap-2">
                <Icon name="chat" className="w-3.5 h-3.5" />
                Booking Support
              </a>
            </div>
          </div>

          {Object.entries(FOOTER_LINKS).map(([section, items]) => (
            <div key={section}>
              <h4 className="text-white font-bold text-sm mb-4">{section}</h4>
              <ul className="space-y-2.5">
                {items.map((item) => (
                  <li key={item.label}>
                    <Link href={item.href} className="nav-focus text-white/55 hover:text-white text-xs transition-colors">
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="pt-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <p className="text-white/45 text-xs">(c) RBA Bike Rentals 2026 · Bengaluru, India</p>
          <div className="flex gap-5">
            {[
              { label: "Privacy", href: "/privacy" },
              { label: "Terms", href: "/terms" },
              { label: "Cookies", href: "/cookies" }
            ].map((item) => (
              <Link key={item.label} href={item.href} className="nav-focus text-white/45 hover:text-white text-xs transition-colors">
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
