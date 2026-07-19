/**
 * MDX content loader — replaces Sanity (docs/Architecture.md).
 *
 * Content lives in `src/content/` and ships with the repo, so edits
 * arrive via pull request and are reviewed like code. That is the point
 * of the MDX-in-repo choice: no CMS to run, no separate publish step,
 * and rules versions are just directories.
 *
 * Layout:
 *   src/content/rules/<edition>/<slug>.mdx   versioned rules
 *   src/content/official/<slug>.mdx          official scenarios
 *   src/content/legal/<slug>.mdx             terms, privacy
 *   src/content/faq.mdx                      single page
 *
 * Reads happen at build time on the server. Slugs are validated before
 * being joined onto a path — an unchecked slug from a route param is a
 * directory-traversal hole.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import matter from "gray-matter";

const CONTENT_ROOT = path.join(process.cwd(), "src", "content");

export type ContentMeta = {
  slug: string;
  title: string;
  description?: string;
  order?: number;
  updated?: string;
};

export type ContentDoc = ContentMeta & {
  body: string;
};

/**
 * Slugs and editions come from URL params, so they are untrusted.
 * Allowing only [a-z0-9-] means "../.." can never reach path.join.
 */
const SAFE_SEGMENT = /^[a-z0-9][a-z0-9-]*$/;

export function isSafeSegment(segment: string): boolean {
  return SAFE_SEGMENT.test(segment);
}

async function readDoc(relativePath: string, slug: string): Promise<ContentDoc | null> {
  try {
    const raw = await fs.readFile(path.join(CONTENT_ROOT, relativePath), "utf8");
    const { data, content } = matter(raw);
    return {
      slug,
      title: typeof data.title === "string" ? data.title : slug,
      description: typeof data.description === "string" ? data.description : undefined,
      order: typeof data.order === "number" ? data.order : undefined,
      updated: typeof data.updated === "string" ? data.updated : undefined,
      body: content,
    };
  } catch {
    // Missing file is a 404, not a crash.
    return null;
  }
}

async function listDir(relativeDir: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(path.join(CONTENT_ROOT, relativeDir), {
      withFileTypes: true,
    });
    return entries
      .filter((e) => e.isFile() && e.name.endsWith(".mdx"))
      .map((e) => e.name.replace(/\.mdx$/, ""));
  } catch {
    return [];
  }
}

/* ── Rules (versioned by edition directory) ─────────────────── */

/**
 * Available rules editions, newest first.
 *
 * Directory names are the version identifiers, so adding an edition is
 * `mkdir src/content/rules/v2` — no code change, no config entry.
 */
export async function listRulesEditions(): Promise<string[]> {
  try {
    const entries = await fs.readdir(path.join(CONTENT_ROOT, "rules"), {
      withFileTypes: true,
    });
    return entries
      .filter((e) => e.isDirectory() && isSafeSegment(e.name))
      .map((e) => e.name)
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

/** The edition shown when the reader has not chosen one. */
export async function getLatestEdition(): Promise<string | null> {
  const editions = await listRulesEditions();
  return editions[0] ?? null;
}

export async function listRules(edition: string): Promise<ContentMeta[]> {
  if (!isSafeSegment(edition)) return [];
  const slugs = await listDir(path.join("rules", edition));
  const docs = await Promise.all(
    slugs.map((slug) => readDoc(path.join("rules", edition, `${slug}.mdx`), slug)),
  );
  return docs
    .filter((d): d is ContentDoc => d !== null)
    .sort(
      (a, b) => (a.order ?? 999) - (b.order ?? 999) || a.title.localeCompare(b.title),
    )
    .map(({ body: _body, ...meta }) => meta);
}

export async function getRule(
  edition: string,
  slug: string,
): Promise<ContentDoc | null> {
  if (!isSafeSegment(edition) || !isSafeSegment(slug)) return null;
  return readDoc(path.join("rules", edition, `${slug}.mdx`), slug);
}

/* ── Official scenarios ─────────────────────────────────────── */

export async function listOfficial(): Promise<ContentMeta[]> {
  const slugs = await listDir("official");
  const docs = await Promise.all(
    slugs.map((slug) => readDoc(path.join("official", `${slug}.mdx`), slug)),
  );
  return docs
    .filter((d): d is ContentDoc => d !== null)
    .sort(
      (a, b) => (a.order ?? 999) - (b.order ?? 999) || a.title.localeCompare(b.title),
    )
    .map(({ body: _body, ...meta }) => meta);
}

export async function getOfficial(slug: string): Promise<ContentDoc | null> {
  if (!isSafeSegment(slug)) return null;
  return readDoc(path.join("official", `${slug}.mdx`), slug);
}

/* ── Legal + FAQ ────────────────────────────────────────────── */

export async function listLegal(): Promise<ContentMeta[]> {
  const slugs = await listDir("legal");
  const docs = await Promise.all(
    slugs.map((slug) => readDoc(path.join("legal", `${slug}.mdx`), slug)),
  );
  return docs
    .filter((d): d is ContentDoc => d !== null)
    .sort((a, b) => a.title.localeCompare(b.title))
    .map(({ body: _body, ...meta }) => meta);
}

export async function getLegal(slug: string): Promise<ContentDoc | null> {
  if (!isSafeSegment(slug)) return null;
  return readDoc(path.join("legal", `${slug}.mdx`), slug);
}

export async function getFaq(): Promise<ContentDoc | null> {
  return readDoc("faq.mdx", "faq");
}
