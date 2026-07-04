import Link from "next/link";
import { COMPANY } from "@/lib/legal/company";

type LegalPageShellProps = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
};

export default function LegalPageShell({ title, subtitle, children }: LegalPageShellProps) {
  return (
    <div className="bg-[color:var(--color-paper)] py-12 sm:py-16 lg:py-20">
      <div className="section-shell max-w-3xl">
        <p className="mb-3 text-sm font-semibold text-[color:var(--color-accent-strong)]">Support</p>
        <h1 className="section-title mb-3">{title}</h1>
        {subtitle ? (
          <p className="section-copy mb-8 text-[color:var(--color-copy)]">{subtitle}</p>
        ) : null}
        <p className="mb-10 text-xs text-[color:var(--color-muted)]">
          Last updated: {COMPANY.lastUpdated} ·{" "}
          <Link href="/faq" className="nav-focus underline underline-offset-2">
            FAQ
          </Link>
          {" · "}
          <a href={`mailto:${COMPANY.supportEmail}`} className="nav-focus underline underline-offset-2">
            {COMPANY.supportEmail}
          </a>
        </p>

        <article className="legal-prose space-y-8 text-sm leading-relaxed text-[color:var(--color-copy)]">
          {children}
        </article>
      </div>
    </div>
  );
}

export function LegalSection({
  title,
  children
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-3 text-lg font-bold text-[color:var(--color-ink)]">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}
