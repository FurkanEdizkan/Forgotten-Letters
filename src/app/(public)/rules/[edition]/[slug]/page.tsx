import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { Mdx } from "@/components/content/Mdx";
import { getRule, listRules, listRulesEditions } from "@/lib/content";

type Params = { edition: string; slug: string };

/** Prerender every rules page across every edition. */
export async function generateStaticParams(): Promise<Params[]> {
  const editions = await listRulesEditions();
  const all = await Promise.all(
    editions.map(async (edition) => {
      const rules = await listRules(edition);
      return rules.map((rule) => ({ edition, slug: rule.slug }));
    }),
  );
  return all.flat();
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { edition, slug } = await params;
  const doc = await getRule(edition, slug);
  if (!doc) return { title: "Not found" };
  return { title: doc.title, description: doc.description };
}

export default async function RulePage({ params }: { params: Promise<Params> }) {
  const { edition, slug } = await params;
  const doc = await getRule(edition, slug);
  if (!doc) notFound();

  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <Link
        href={`/rules?edition=${edition}`}
        className="mb-6 inline-flex items-center gap-1.5 font-mono text-[0.625rem] uppercase tracking-wider text-faint hover:text-primary"
      >
        <ArrowLeft className="size-3" /> All rules
      </Link>

      <p className="font-mono text-[0.625rem] uppercase tracking-[0.2em] text-accent">
        Edition {edition}
      </p>
      <h1 className="mt-2 font-display text-3xl text-ink">{doc.title}</h1>
      {doc.updated && (
        <p className="mt-2 font-mono text-xs text-faint">Updated {doc.updated}</p>
      )}

      <div className="mt-8">
        <Mdx source={doc.body} />
      </div>
    </article>
  );
}
