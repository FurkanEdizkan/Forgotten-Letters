import { matchesGlob } from 'node:path';
import { LikeC4 } from 'likec4';

/**
 * The model as plain data. Elements point at the code with metadata:
 *   code    'path' or ['glob', …]   files this element is made of
 *   tables  ['user', …]             Drizzle tables it groups
 *   services ['db', 'pgdata']       the compose services and volumes it is
 *   generated 'true'                written by `atlas update`, never by hand
 */
export interface El {
	id: string;
	kind: string;
	title: string;
	description: string;
	tags: string[];
	code: string[];
	tables: string[];
	services: string[];
	generated: boolean;
	parent: string | null;
}
export interface Rel {
	source: string;
	target: string;
	kind: string | null;
	title: string;
	generated: boolean;
}
export interface View {
	id: string;
	title: string;
	description: string;
	dynamic: boolean;
	steps: { from: string; to: string; label: string }[];
}
export interface Model {
	elements: El[];
	relationships: Rel[];
	views: View[];
}

const list = (v: unknown): string[] => (v == null ? [] : Array.isArray(v) ? v.map(String) : [String(v)]);
/** A description as written: plain text or Markdown. */
const textOf = (src: { txt?: string; md?: string } | null) => (src?.md ?? src?.txt ?? '').trim();
/** The first sentence, on one line, without Markdown marks. */
const firstSentence = (s: string) => {
	const flat = s.replace(/[*_`#]/g, '').replace(/\s+/g, ' ').trim();
	const end = flat.search(/\.(\s|$)/);
	return end >= 0 ? flat.slice(0, end + 1) : flat;
};

export async function loadModel(dir: string): Promise<Model> {
	await using likec4 = await LikeC4.fromWorkspace(dir, { logger: false, throwIfInvalid: true });
	const m = await likec4.computedModel();
	const elements: El[] = [...m.elements()].map((e) => {
		const meta = e.getMetadata() as Record<string, unknown>;
		return {
			id: e.id,
			kind: e.kind,
			title: e.title,
			description: textOf(e.description.$source),
			tags: [...e.tags],
			code: list(meta.code),
			tables: list(meta.tables),
			services: list(meta.services),
			generated: meta.generated === 'true',
			parent: e.parent?.id ?? null
		};
	});
	const relationships: Rel[] = [...m.relationships()].map((r) => ({
		source: r.source.id,
		target: r.target.id,
		kind: r.kind ?? null,
		title: r.title ?? '',
		generated: (r.getMetadata() as Record<string, unknown>).generated === 'true'
	}));
	const views: View[] = [...m.views()].map((v) => {
		const $v = v.$view as unknown as { _type: string; description?: { txt?: string; md?: string } | null; edges: { source: string; target: string; label: string | null }[] };
		const nodes = new Map([...v.nodes()].map((n) => [n.id as string, (n.element?.id ?? n.id) as string]));
		const dynamic = $v._type === 'dynamic';
		return {
			id: v.id,
			title: v.title ?? v.id,
			description: textOf($v.description ?? null),
			dynamic,
			steps: dynamic ? $v.edges.map((e) => ({ from: nodes.get(e.source) ?? e.source, to: nodes.get(e.target) ?? e.target, label: e.label ?? '' })) : []
		};
	});
	return { elements, relationships, views };
}

/** An element's description in one short line for MAP.md (the full text is in the model and the site). */
export const summary = (e: El, max = 140) => {
	const s = firstSentence(e.description);
	return s.length <= max ? s : s.slice(0, s.lastIndexOf(' ', max)).replace(/[,;:(]$/, '') + '…';
};

/** How specific a pattern is: its literal characters (a file path beats a folder glob, a folder beats its parent). */
const specificity = (p: string) => p.replace(/[*?{}[\]]/g, '').length;
const depth = (id: string) => id.split('.').length;

/** The element a file belongs to: the most specific `code` pattern that matches it, the deeper element on a tie. */
export function ownerOf(path: string, elements: El[], opts: { curatedOnly?: boolean } = {}): El | null {
	let best: { el: El; score: number } | null = null;
	for (const el of elements) {
		if (opts.curatedOnly && el.generated) continue;
		for (const p of el.code) {
			if (p !== path && !matchesGlob(path, p)) continue;
			const score = (p === path ? 1e6 : specificity(p)) * 100 + depth(el.id);
			if (!best || score > best.score) best = { el, score };
		}
	}
	return best?.el ?? null;
}

/** `a` is `b` or sits inside it. */
export const within = (a: string, b: string) => a === b || a.startsWith(b + '.');
