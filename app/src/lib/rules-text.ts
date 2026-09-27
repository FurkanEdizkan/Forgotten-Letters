import { keywordKey } from './keywords';

/** A rules page body (see `rules_page.body`) as blocks to render. */
export type Block =
	| { kind: 'heading'; text: string }
	| { kind: 'bullet'; text: string }
	| { kind: 'table'; rows: string[][] }
	| { kind: 'para'; text: string };

export function blocks(body: string): Block[] {
	const out: Block[] = [];
	for (const raw of body.split(/\n{2,}/)) {
		const t = raw.trim();
		if (!t) continue;
		if (t.startsWith('### ')) out.push({ kind: 'heading', text: t.slice(4) });
		else if (t.startsWith('| ')) {
			const row = t.slice(2).split(' | ').map((c) => c.trim());
			const last = out.at(-1);
			if (last?.kind === 'table') last.rows.push(row);
			else out.push({ kind: 'table', rows: [row] });
		} else if (t.startsWith('*')) out.push({ kind: 'bullet', text: t.replace(/^\*\s*/, '') });
		else out.push({ kind: 'para', text: t });
	}
	return out;
}

/** Split text so glossary keywords written in capitals ("ASSAULT", "IGNORE COVER") can be linked. */
export function segments(text: string, glossary: Record<string, string>) {
	const out: { text: string; keyword?: string; rule?: string }[] = [];
	let at = 0;
	for (const m of text.matchAll(/\b[A-Z]{3,}(?: [A-Z]{2,})*\b/g)) {
		// "IGNORE COVER" may be one keyword or two; try the longest run first, then its first word.
		const words = m[0].split(' ');
		for (let n = words.length; n > 0; n--) {
			const k = words.slice(0, n).join(' ');
			const rule = glossary[keywordKey(k)];
			if (!rule) continue;
			if (m.index! > at) out.push({ text: text.slice(at, m.index) });
			out.push({ text: k, keyword: keywordKey(k), rule });
			at = m.index! + k.length;
			break;
		}
	}
	if (at < text.length) out.push({ text: text.slice(at) });
	return out;
}
