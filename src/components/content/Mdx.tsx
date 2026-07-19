/**
 * MDX renderer.
 *
 * Content is repo-authored and PR-reviewed, so it is not hostile input
 * the way a user comment is. rehype-sanitize is applied anyway: the cost
 * is negligible and it means a careless paste into an .mdx file cannot
 * become stored XSS on a page every visitor loads.
 *
 * Sanitizing removes raw HTML/script but leaves markdown structure, so
 * headings, tables (via remark-gfm) and links all still render.
 */
import { MDXRemote } from "next-mdx-remote/rsc";
import rehypeSanitize from "rehype-sanitize";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";

import { FL_PROSE } from "./prose";

export function Mdx({ source }: { source: string }) {
  return (
    <div className={FL_PROSE}>
      <MDXRemote
        source={source}
        options={{
          mdxOptions: {
            remarkPlugins: [remarkGfm],
            // rehypeSlug adds heading ids so deep links work.
            rehypePlugins: [rehypeSanitize, rehypeSlug],
          },
        }}
      />
    </div>
  );
}
