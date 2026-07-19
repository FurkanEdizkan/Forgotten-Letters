import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Mdx } from "@/components/content/Mdx";
import { getLegal, listLegal } from "@/lib/content";

type Params = { slug: string };

export async function generateStaticParams(): Promise<Params[]> {
  const docs = await listLegal();
  return docs.map((d) => ({ slug: d.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const doc = await getLegal(slug);
  if (!doc) return { title: "Not found" };
  return { title: doc.title, description: doc.description };
}

export default async function LegalPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const doc = await getLegal(slug);
  if (!doc) notFound();

  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
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
