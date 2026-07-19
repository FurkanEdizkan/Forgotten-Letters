import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { Mdx } from "@/components/content/Mdx";
import { getOfficial, listOfficial } from "@/lib/content";

type Params = { slug: string };

export async function generateStaticParams(): Promise<Params[]> {
  const scenarios = await listOfficial();
  return scenarios.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const doc = await getOfficial(slug);
  if (!doc) return { title: "Not found" };
  return { title: doc.title, description: doc.description };
}

export default async function OfficialScenarioPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const doc = await getOfficial(slug);
  if (!doc) notFound();

  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <Link
        href="/official"
        className="mb-6 inline-flex items-center gap-1.5 font-mono text-[0.625rem] uppercase tracking-wider text-faint hover:text-primary"
      >
        <ArrowLeft className="size-3" /> All official scenarios
      </Link>
      <h1 className="font-display text-3xl text-ink">{doc.title}</h1>
      {doc.updated && (
        <p className="mt-2 font-mono text-xs text-faint">Updated {doc.updated}</p>
      )}
      <div className="mt-8">
        <Mdx source={doc.body} />
      </div>
    </article>
  );
}
