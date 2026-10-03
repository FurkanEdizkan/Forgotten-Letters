/**
 * The Rules Editor's drag and drop: what is being dragged (a name from the library or a chip list, a limit, or a
 * row being reordered), and the chip list a click in the library adds to (the last one focused), so every drag
 * has a click and keyboard equivalent.
 */
export type Kind = 'keyword' | 'item' | 'unit' | 'upgrade' | 'skill' | 'limit' | 'row';

export const drag = $state<{ kind: Kind | null; value: unknown; from: symbol | null; index: number }>({ kind: null, value: null, from: null, index: -1 });

export const target = $state<{ kind: Kind | null; label: string; add: ((v: unknown) => void) | null }>({ kind: null, label: '', add: null });

export function startDrag(e: DragEvent, kind: Kind, value: unknown, from: symbol | null = null, index = -1) {
	Object.assign(drag, { kind, value, from, index });
	if (e.dataTransfer) {
		e.dataTransfer.effectAllowed = 'copyMove';
		// Firefox starts a drag only with data; a name dropped in a plain field lands as text.
		e.dataTransfer.setData('text/plain', typeof value === 'string' ? value : JSON.stringify(value));
	}
}

export function endDrag() {
	Object.assign(drag, { kind: null, value: null, from: null, index: -1 });
}

/** Can a drop target taking `kinds` take what is being dragged? */
export const accepts = (kinds: Kind[]) => !!drag.kind && kinds.includes(drag.kind);
