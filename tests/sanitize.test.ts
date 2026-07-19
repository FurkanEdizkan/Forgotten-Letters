/**
 * Sanitizer tests.
 *
 * This is the boundary between user input and every reader's browser,
 * so the cases here are attacks, not formatting preferences.
 */
import { describe, expect, it } from "vitest";

import { sanitizeComment, sanitizeRichText, stripHtml } from "@/lib/sanitize";

describe("sanitizeRichText", () => {
  it("keeps ordinary formatting", () => {
    const html = "<p>A <strong>bold</strong> and <em>italic</em> line.</p>";
    expect(sanitizeRichText(html)).toBe(html);
  });

  it("removes script tags and their contents", () => {
    // Leaving the text behind would render "alert(1)" as visible copy.
    const out = sanitizeRichText("<p>hi</p><script>alert(1)</script>");
    expect(out).not.toContain("script");
    expect(out).not.toContain("alert(1)");
    expect(out).toContain("hi");
  });

  it("strips inline event handlers", () => {
    const out = sanitizeRichText('<p onclick="steal()">text</p>');
    expect(out).not.toContain("onclick");
    expect(out).toContain("text");
  });

  it("strips javascript: URLs", () => {
    const out = sanitizeRichText('<a href="javascript:alert(1)">click</a>');
    expect(out).not.toContain("javascript:");
  });

  it("strips data: URLs", () => {
    // data:text/html can carry a whole executing document.
    const out = sanitizeRichText(
      '<a href="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==">x</a>',
    );
    expect(out).not.toContain("data:");
  });

  it("removes img tags entirely", () => {
    // Not in the allowlist: onerror is a classic XSS vector, and images
    // belong in the uploads flow where they are size- and MIME-checked.
    const out = sanitizeRichText('<img src=x onerror="alert(1)">');
    expect(out).not.toContain("img");
    expect(out).not.toContain("onerror");
  });

  it("removes iframes", () => {
    const out = sanitizeRichText('<iframe src="https://evil.test"></iframe>');
    expect(out).not.toContain("iframe");
  });

  it("removes style tags and their contents", () => {
    const out = sanitizeRichText("<style>body{display:none}</style><p>x</p>");
    expect(out).not.toContain("display:none");
    expect(out).toContain("x");
  });

  it("hardens external links", () => {
    // Without noopener the opened page can navigate ours via
    // window.opener.
    const out = sanitizeRichText('<a href="https://example.test">x</a>');
    expect(out).toContain('rel="nofollow noopener noreferrer"');
    expect(out).toContain('target="_blank"');
  });

  it("keeps http, https, and mailto links", () => {
    for (const href of [
      "https://example.test",
      "http://example.test",
      "mailto:a@b.test",
    ]) {
      expect(sanitizeRichText(`<a href="${href}">x</a>`)).toContain(href);
    }
  });

  it("survives malformed and nested markup", () => {
    // A naive regex-based stripper leaves "<script>" behind here.
    const out = sanitizeRichText("<scr<script>ipt>alert(1)</script>");
    expect(out.toLowerCase()).not.toContain("<script");
  });

  it("keeps tables, which scenarios use for event tables", () => {
    const out = sanitizeRichText("<table><tr><td>1</td></tr></table>");
    expect(out).toContain("<td>");
  });
});

describe("sanitizeComment", () => {
  it("keeps basic formatting", () => {
    expect(sanitizeComment("<p><strong>hi</strong></p>")).toContain("<strong>");
  });

  it("strips headings and tables that comments do not need", () => {
    const out = sanitizeComment("<h2>shout</h2><table><tr><td>x</td></tr></table>");
    expect(out).not.toContain("<h2>");
    expect(out).not.toContain("<table>");
    // Text survives; only the markup is dropped.
    expect(out).toContain("shout");
  });

  it("strips scripts", () => {
    const out = sanitizeComment("<script>alert(1)</script>ok");
    expect(out).not.toContain("script");
    expect(out).toContain("ok");
  });
});

describe("stripHtml", () => {
  it("returns plain text", () => {
    expect(stripHtml("<p>Hello <strong>there</strong></p>")).toBe("Hello there");
  });

  it("drops script contents rather than exposing them", () => {
    expect(stripHtml("<script>alert(1)</script>visible")).toBe("visible");
  });
});
