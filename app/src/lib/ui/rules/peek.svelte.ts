/**
 * Rules cards over a page instead of a trip to the docs (2026-11-03): a link with `use:peek={id}` shows the element's
 * card when the pointer rests on it (500 ms) or keeps it open when clicked. Clicks with a modifier key or the middle
 * button still follow the link. The action does nothing unless a RulesPeek host is mounted (the builder and play
 * mode mount one; the compendium does not, so its links navigate as before).
 */

export const peekState = $state({
	host: false,
	id: null as string | null,
	anchor: null as HTMLElement | null,
	pinned: false
});

let openTimer: ReturnType<typeof setTimeout> | undefined;
let closeTimer: ReturnType<typeof setTimeout> | undefined;

export function showPeek(id: string, anchor: HTMLElement, pinned: boolean) {
	clearTimeout(openTimer);
	clearTimeout(closeTimer);
	Object.assign(peekState, { id, anchor, pinned });
}

export function hidePeek() {
	clearTimeout(openTimer);
	clearTimeout(closeTimer);
	Object.assign(peekState, { id: null, anchor: null, pinned: false });
}

/** Leaving a link or the card: close soon, so the pointer can cross the gap between them. */
export function closeSoon() {
	clearTimeout(openTimer);
	if (peekState.pinned) return;
	clearTimeout(closeTimer);
	closeTimer = setTimeout(hidePeek, 150);
}

export const stayOpen = () => clearTimeout(closeTimer);

export function peek(node: HTMLElement, id: string) {
	let current = id;
	const enter = () => {
		if (!peekState.host || peekState.pinned) return;
		stayOpen();
		clearTimeout(openTimer);
		openTimer = setTimeout(() => showPeek(current, node, false), 500);
	};
	const click = (e: MouseEvent) => {
		if (!peekState.host || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)
			return;
		e.preventDefault();
		showPeek(current, node, true);
	};
	node.addEventListener('mouseenter', enter);
	node.addEventListener('mouseleave', closeSoon);
	node.addEventListener('click', click);
	return {
		update(next: string) {
			current = next;
		},
		destroy() {
			node.removeEventListener('mouseenter', enter);
			node.removeEventListener('mouseleave', closeSoon);
			node.removeEventListener('click', click);
			if (peekState.anchor === node && !peekState.pinned) hidePeek();
		}
	};
}

type Box = { left: number; top: number; bottom: number; width: number; height: number };

/**
 * Where the card goes: under its link, or above it when there is no room below, kept `margin` inside the window
 * (top-left corner, in viewport pixels).
 */
export function place(
	anchor: Box,
	card: { width: number; height: number },
	view: { width: number; height: number },
	margin = 8
): { x: number; y: number } {
	const below = anchor.bottom + 4;
	const above = anchor.top - 4 - card.height;
	const y =
		below + card.height <= view.height - margin || above < margin
			? Math.max(margin, Math.min(below, view.height - margin - card.height))
			: above;
	const x = Math.max(margin, Math.min(anchor.left, view.width - margin - card.width));
	return { x, y };
}
