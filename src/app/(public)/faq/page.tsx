import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Mdx } from "@/components/content/Mdx";
import { getFaq } from "@/lib/content";

export async function generateMetadata(): Promise<Metadata> {
  const doc = await getFaq();
  return {
    title: doc?.title ?? "FAQ",
    description: doc?.description,
  };
}

export default async function FaqPage() {
  const doc = await getFaq();
  if (!doc) notFound();

  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="font-display text-3xl text-ink">{doc.title}</h1>
      <div className="mt-8">
        <Mdx source={doc.body} />
      </div>
    </article>
  );
}
