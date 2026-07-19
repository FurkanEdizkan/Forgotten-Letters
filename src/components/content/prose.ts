/**
 * Typography for rendered MDX.
 *
 * Written as explicit token-based utilities rather than a prose plugin
 * so the FL palette (docs/DesignSystem.md) applies directly and headings
 * pick up Cinzel like the rest of the app.
 */
export const FL_PROSE = [
  "max-w-none",
  "[&>h2]:mt-10 [&>h2]:mb-3 [&>h2]:font-display [&>h2]:text-2xl [&>h2]:text-ink",
  "[&>h3]:mt-8 [&>h3]:mb-2 [&>h3]:font-display [&>h3]:text-xl [&>h3]:text-ink",
  "[&>h4]:mt-6 [&>h4]:mb-2 [&>h4]:font-display [&>h4]:text-lg [&>h4]:text-ink",
  "[&>p]:mb-4 [&>p]:leading-relaxed [&>p]:text-muted",
  "[&>ul]:mb-4 [&>ul]:list-disc [&>ul]:pl-6 [&>ul]:text-muted [&>ul>li]:mb-1.5",
  "[&>ol]:mb-4 [&>ol]:list-decimal [&>ol]:pl-6 [&>ol]:text-muted [&>ol>li]:mb-1.5",
  "[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 hover:[&_a]:text-primary-hover",
  "[&_strong]:text-ink [&_strong]:font-semibold",
  "[&_code]:rounded [&_code]:bg-elevated [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-sm [&_code]:text-accent",
  "[&>blockquote]:my-5 [&>blockquote]:border-l-2 [&>blockquote]:border-accent [&>blockquote]:pl-4 [&>blockquote]:italic [&>blockquote]:text-muted",
  "[&>hr]:my-8 [&>hr]:border-border",
  // Tables must scroll rather than blow out the page on mobile.
  "[&_table]:my-5 [&_table]:w-full [&_table]:border-collapse [&_table]:text-sm",
  "[&_th]:border [&_th]:border-border [&_th]:bg-elevated [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-mono [&_th]:text-xs [&_th]:uppercase [&_th]:tracking-wider [&_th]:text-muted",
  "[&_td]:border [&_td]:border-border [&_td]:px-3 [&_td]:py-2 [&_td]:text-muted",
].join(" ");
