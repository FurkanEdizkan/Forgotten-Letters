import Link from "next/link";
import { Crosshair } from "lucide-react";

const FOOTER_SECTIONS = [
  {
    title: "Repository",
    links: [
      { href: "/scenarios", label: "Browse Scenarios" },
      { href: "/campaigns", label: "Campaigns" },
      { href: "/official", label: "Official Content" },
      { href: "/rules", label: "Rules" },
    ],
  },
  {
    title: "Create",
    links: [
      { href: "/scenarios/new", label: "New Scenario" },
      { href: "/campaigns/new", label: "New Campaign" },
      { href: "/register", label: "Enlist" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.5fr_1fr_1fr]">
        <div className="max-w-xs">
          <div className="flex items-center gap-2.5">
            <span className="grid size-8 place-items-center rounded-[var(--radius-sm)] border border-primary/40 bg-primary-soft text-primary">
              <Crosshair className="size-4" strokeWidth={2.25} />
            </span>
            <span className="font-display text-base font-semibold uppercase tracking-tight text-ink">
              Forgotten Letters
            </span>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-muted">
            A community-built repository for wargame scenarios — forge, share,
            and deploy campaigns for Trench Crusade and beyond.
          </p>
        </div>

        {FOOTER_SECTIONS.map((section) => (
          <div key={section.title}>
            <h2 className="font-mono text-xs font-semibold uppercase tracking-wider text-faint">
              {section.title}
            </h2>
            <ul className="mt-4 flex flex-col gap-2.5">
              {section.links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted transition-colors hover:text-primary"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-5 text-xs text-faint sm:flex-row sm:px-6">
          <p className="font-mono uppercase tracking-wider">
            © {new Date().getFullYear()} Forgotten Letters
          </p>
          <p className="font-mono tracking-wide">
            Fan project. Not affiliated with Trench Crusade.
          </p>
        </div>
      </div>
    </footer>
  );
}
