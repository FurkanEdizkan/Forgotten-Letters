import Link from "next/link";
import { UserCog, ShieldAlert, HardDrive } from "lucide-react";

const SETTINGS_NAV = [
  { href: "/settings/profile", label: "Profile", icon: UserCog },
  { href: "/settings/account", label: "Account", icon: ShieldAlert },
  { href: "/settings/storage", label: "Storage", icon: HardDrive },
];

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <header className="border-b border-border pb-6">
        <p className="font-mono text-xs uppercase tracking-wider text-faint">
          Command // Settings
        </p>
        <h1 className="mt-1 font-display text-3xl font-bold uppercase tracking-tight text-ink">
          Settings
        </h1>
      </header>

      <div className="mt-8 grid gap-8 md:grid-cols-[200px_1fr]">
        <nav className="flex flex-row gap-1 md:flex-col">
          {SETTINGS_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-2.5 rounded-[var(--radius-md)] px-3 py-2 font-mono text-xs font-medium uppercase tracking-wider text-muted transition-colors hover:bg-surface hover:text-ink"
            >
              <item.icon className="size-4" />
              {item.label}
            </Link>
          ))}
        </nav>
        <div>{children}</div>
      </div>
    </div>
  );
}
