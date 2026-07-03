import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowUp, ScrollText, CalendarDays } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { ScenarioCard } from "@/components/social/ScenarioCard";
import { MOCK_SCENARIOS } from "@/lib/mock/scenarios";

// Placeholder — real profile from Supabase (Phase 6).
const KNOWN_AUTHORS = ["trench_rat", "sister_agnes", "gunnery_sgt", "vox_caster"];

const BIOS: Record<string, string> = {
  trench_rat:
    "Veteran scenario-smith. Specializes in objective-control missions where the terrain fights back.",
};

export function generateStaticParams() {
  return KNOWN_AUTHORS.map((username) => ({ username }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  return { title: `@${username}` };
}

export default async function UserProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  if (!KNOWN_AUTHORS.includes(username)) notFound();

  const scenarios = MOCK_SCENARIOS.filter((s) => s.author === username);
  const totalVotes = scenarios.reduce((sum, s) => sum + s.votes, 0);
  const bio = BIOS[username] ?? "A scenario-smith on the Forgotten Letters front.";

  const stats = [
    { icon: ScrollText, label: "Scenarios", value: scenarios.length },
    { icon: ArrowUp, label: "Votes received", value: totalVotes },
    { icon: CalendarDays, label: "Enlisted", value: "2024" },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      {/* Profile header */}
      <header className="flex flex-col gap-6 border-b border-border pb-8 sm:flex-row sm:items-center">
        <Avatar name={username} size="lg" className="size-20 text-xl" />
        <div className="flex-1">
          <h1 className="font-display text-3xl font-bold tracking-tight text-ink">
            @{username}
          </h1>
          <p className="mt-2 max-w-xl text-muted">{bio}</p>
        </div>
        <dl className="flex gap-6">
          {stats.map((stat) => (
            <div key={stat.label} className="text-center">
              <dt className="flex items-center justify-center gap-1 font-mono text-[0.625rem] uppercase tracking-wider text-faint">
                <stat.icon className="size-3" /> {stat.label}
              </dt>
              <dd className="mt-1 font-display text-2xl font-bold text-ink">
                {stat.value}
              </dd>
            </div>
          ))}
        </dl>
      </header>

      <section className="mt-8">
        <h2 className="font-mono text-xs font-semibold uppercase tracking-wider text-faint">
          Published scenarios
        </h2>
        {scenarios.length > 0 ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {scenarios.map((scenario) => (
              <ScenarioCard key={scenario.slug} scenario={scenario} />
            ))}
          </div>
        ) : (
          <p className="mt-4 text-muted">No published scenarios yet.</p>
        )}
      </section>
    </div>
  );
}
