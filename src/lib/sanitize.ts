/**
 * HTML sanitization for user-authored rich text.
 *
 * Scenario stories and comments are written in Tiptap, which produces
 * HTML. That HTML is rendered back with dangerouslySetInnerHTML, so it
 * is the single highest-risk input in the application: anything that
 * survives here executes in every reader's browser.
 *
 * Sanitize on **write**, not on render. Rendering happens in many places
 * and one forgotten call is stored XSS; writing happens in a handful of
 * server actions that are easy to audit.
 *
 * The allowlist is deliberately narrow. Adding a tag is a security
 * decision, not a formatting one.
 */
import sanitizeHtml from "sanitize-html";

/** Tags a scenario story or comment may contain. */
const ALLOWED_TAGS = [
  "p",
  "br",
  "strong",
  "em",
  "u",
  "s",
  "blockquote",
  "ul",
  "ol",
  "li",
  "h2",
  "h3",
  "h4",
  "code",
  "pre",
  "hr",
  "a",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
];

const BASE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ALLOWED_TAGS,
  allowedAttributes: {
    // rel and target must be allowed here or transformTags adds them and
    // the attribute filter immediately strips them back off, silently
    // undoing the link hardening below.
    a: ["href", "title", "rel", "target"],
    // Tiptap emits these for alignment; everything else is dropped.
    th: ["colspan", "rowspan"],
    td: ["colspan", "rowspan"],
  },
  // No javascript:, no data: — data: URLs can carry HTML that executes.
  allowedSchemes: ["http", "https", "mailto"],
  allowedSchemesAppliedToAttributes: ["href"],
  // Strip the contents of anything removed, so <script>alert(1)</script>
  // does not leave "alert(1)" as visible text.
  nonTextTags: ["style", "script", "textarea", "option", "noscript"],
  transformTags: {
    // External links open in a new tab; noopener prevents the opened
    // page from reaching back via window.opener.
    a: (tagName, attribs) => ({
      tagName,
      attribs: {
        ...attribs,
        rel: "nofollow noopener noreferrer",
        target: "_blank",
      },
    }),
  },
};

/** Sanitize a scenario story or section body. */
export function sanitizeRichText(dirty: string): string {
  return sanitizeHtml(dirty, BASE_OPTIONS);
}

/**
 * Sanitize a comment.
 *
 * Tighter than scenario bodies: comments have no reason to contain
 * headings, tables, or code blocks, and every additional tag is more
 * surface for a formatting-based abuse vector.
 */
export function sanitizeComment(dirty: string): string {
  return sanitizeHtml(dirty, {
    ...BASE_OPTIONS,
    allowedTags: [
      "p",
      "br",
      "strong",
      "em",
      "s",
      "blockquote",
      "ul",
      "ol",
      "li",
      "a",
      "code",
    ],
    allowedAttributes: { a: ["href", "title", "rel", "target"] },
  });
}

/** Strip all markup — for summaries, meta descriptions, and search text. */
export function stripHtml(dirty: string): string {
  return sanitizeHtml(dirty, { allowedTags: [], allowedAttributes: {} }).trim();
}
