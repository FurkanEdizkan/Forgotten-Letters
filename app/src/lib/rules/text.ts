/**
 * Rules text: the group's own copy, with inline links to elements as `[[id]]` or `[[id|label]]`, in a small
 * markdown-lite (`## ` headings, paragraphs split by blank lines, `- ` or `* ` list items). Parsed into a tree the compendium
 * renders with Svelte elements, so no HTML from a rules folder ever reaches the page.
 */

/** `[[id]]` or `[[id|label]]`. */
const LINK = /\[\[\s*([^\]|\s][^\]|]*?)\s*(?:\|([^\]]*))?\]\]/g;

export type Inline = { t: 'text'; text: string } | { t: 'link'; id: string; label: string | null };
export type Block =
	{ t: 'h'; text: Inline[] } | { t: 'p'; text: Inline[] } | { t: 'ul'; items: Inline[][] };

/** Every id linked in `s`, in order, with repeats. */
export const linksIn = (s: string): string[] => [...s.matchAll(LINK)].map((m) => m[1]!);

/** One line of text as plain runs and links. */
export function inline(s: string): Inline[] {
	const out: Inline[] = [];
	let at = 0;
	for (const m of s.matchAll(LINK)) {
		if (m.index > at) out.push({ t: 'text', text: s.slice(at, m.index) });
		out.push({ t: 'link', id: m[1]!, label: m[2]?.trim() || null });
		at = m.index + m[0].length;
	}
	if (at < s.length) out.push({ t: 'text', text: s.slice(at) });
	return out;
}

/** A body as headings, paragraphs and lists. Lines inside a paragraph are joined with a space. */
export function blocks(body: string): Block[] {
	const out: Block[] = [];
	let para: string[] = [];
	let list: string[] = [];
	const flush = () => {
		if (para.length) out.push({ t: 'p', text: inline(para.join(' ')) });
		if (list.length) out.push({ t: 'ul', items: list.map(inline) });
		para = [];
		list = [];
	};
	for (const raw of body.split(/\r?\n/)) {
		const line = raw.trim();
		if (!line) flush();
		else if (line.startsWith('## ')) {
			flush();
			out.push({ t: 'h', text: inline(line.slice(3).trim()) });
		} else if (line.startsWith('- ') || line.startsWith('* ')) {
			if (para.length) flush();
			list.push(line.slice(2).trim());
		} else {
			if (list.length) flush();
			para.push(line);
		}
	}
	flush();
	return out;
}

/** An id as URL path segments: its `/` stay segments, `:` and `#` are encoded. */
export const idPath = (id: string) => id.split('/').map(encodeURIComponent).join('/');

/** The compendium page of an element. */
export const elementHref = (set: string, id: string) =>
	`/rules/${encodeURIComponent(set)}/e/${idPath(id)}`;

/** A faction's or variant's warband page. */
export const warbandHref = (set: string, id: string) =>
	`/rules/${encodeURIComponent(set)}/warbands/${idPath(id)}`;
